import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";
import {
  CoalitionConfig,
  COALITIONS,
  TRACKED_PARTIES,
  ABBR_MAP,
  getCoalitionBySlug,
  getCoalitionForDate,
} from "./coalitions.config";
import { PartiesScorecardService } from "../parties/parties-scorecard.service";

// ─── Types ───────────────────────────────────────────────────

export type VoteClassification = "coalition" | "free" | "no_data";

export interface ClassificationSummary {
  coalitionName: string;
  coalitionSlug: string;
  totalVotes: number;
  coalitionVotes: number;
  freeVotes: number;
  noDataVotes: number;
}

export interface CoalitionAlignmentResult {
  partyId: string | null;
  abbreviation: string;
  coalitionName: string;
  coalitionSlug: string;
  periodStart: string;
  periodEnd: string;
  totalVotesAnalyzed: number;
  alignedWithCoalition: number;
  cai: number; // 0-100
  isCoalitionMember: boolean;
}

export interface VrijeStemmenResult {
  partyId: string;
  abbreviation: string;
  coalitionName: string;
  coalitionSlug: string;
  electionYear: number;
  totalMCS: number;
  vrijeStemmenMCS: number;
  delta: number; // totalMCS - vrijeStemmenMCS (positive = inflated by discipline)
  freeVoteCount: number;
  coalitionVoteCount: number;
  totalVoteCount: number;
  scoredPromises: number;
  freeVoteScoredPromises: number;
}

// ─── Lightweight vote row — only id, date, and Stemming ──────

interface LightVoteRow {
  id: string;
  date: Date | null;
  stemming: { ActorNaam: string; Soort: string }[] | null;
}

// ─── Service ─────────────────────────────────────────────────

/**
 * Use raw SQL to extract ONLY the Stemming array from rawData.
 * This avoids loading the full rawData blob (~5-10KB per vote)
 * which caused OOM on 512MB Fly machines.
 */
const BATCH_SIZE = 500;

@Injectable()
export class CoalitionDynamicsService {
  private readonly logger = new Logger(CoalitionDynamicsService.name);

  constructor(
    private readonly scorecardService: PartiesScorecardService,
  ) {}

  /**
   * Fetch votes in batches using raw SQL, extracting only the Stemming array.
   * This is ~10x more memory-efficient than loading full rawData via Prisma.
   */
  private async fetchLightVotes(
    dateGte?: Date,
    dateLte?: Date,
  ): Promise<LightVoteRow[]> {
    const allRows: LightVoteRow[] = [];
    let offset = 0;

    while (true) {
      let rows: any[];

      if (dateGte && dateLte) {
        rows = await prisma.$queryRawUnsafe(
          `SELECT id, date, raw_data->'Stemming' AS stemming
           FROM votes
           WHERE date >= $1 AND date <= $2
           ORDER BY date DESC
           LIMIT $3 OFFSET $4`,
          dateGte,
          dateLte,
          BATCH_SIZE,
          offset,
        );
      } else if (dateGte) {
        rows = await prisma.$queryRawUnsafe(
          `SELECT id, date, raw_data->'Stemming' AS stemming
           FROM votes
           WHERE date >= $1
           ORDER BY date DESC
           LIMIT $2 OFFSET $3`,
          dateGte,
          BATCH_SIZE,
          offset,
        );
      } else {
        rows = await prisma.$queryRawUnsafe(
          `SELECT id, date, raw_data->'Stemming' AS stemming
           FROM votes
           ORDER BY date DESC
           LIMIT $1 OFFSET $2`,
          BATCH_SIZE,
          offset,
        );
      }

      if (rows.length === 0) break;

      for (const row of rows) {
        allRows.push({
          id: row.id,
          date: row.date,
          stemming: row.stemming ?? null,
        });
      }

      offset += rows.length;
      if (rows.length < BATCH_SIZE) break;
    }

    return allRows;
  }

  /**
   * Extract party stances from a lightweight Stemming array.
   */
  private extractStances(
    stemming: { ActorNaam: string; Soort: string }[] | null,
  ): Map<string, string> {
    const stances = new Map<string, string>();
    if (!stemming || stemming.length === 0) return stances;

    for (const s of stemming) {
      if (s.Soort === "Niet deelgenomen") continue;
      const name = ABBR_MAP[s.ActorNaam] ?? s.ActorNaam;
      const soort = s.Soort?.toLowerCase();
      if (soort === "voor") stances.set(name, "FOR");
      else if (soort === "tegen") stances.set(name, "AGAINST");
    }

    return stances;
  }

  /**
   * Classify a single vote against a coalition using Stemming data.
   */
  private classifySingleVote(
    stemming: { ActorNaam: string; Soort: string }[] | null,
    coalition: CoalitionConfig,
  ): VoteClassification {
    const stances = this.extractStances(stemming);

    const coalitionStances: string[] = [];
    let allPresent = true;
    for (const p of coalition.parties) {
      const stance = stances.get(p);
      if (stance) {
        coalitionStances.push(stance);
      } else {
        allPresent = false;
      }
    }

    if (coalitionStances.length < 2) {
      return "no_data";
    } else if (
      allPresent &&
      coalitionStances.every((s) => s === coalitionStances[0])
    ) {
      return "coalition";
    } else {
      return "free";
    }
  }

  /**
   * Classify votes and return summary counts only (memory-efficient).
   */
  async classifyVotes(
    coalitionSlug?: string,
  ): Promise<ClassificationSummary> {
    const coalition = coalitionSlug
      ? getCoalitionBySlug(coalitionSlug)
      : null;

    if (coalitionSlug && !coalition) {
      throw new NotFoundException(`Coalition '${coalitionSlug}' not found`);
    }

    let totalVotes = 0;
    let coalitionVotes = 0;
    let freeVotes = 0;
    let noDataVotes = 0;

    const dateGte = coalition ? new Date(coalition.startDate) : undefined;
    const dateLte = coalition?.endDate
      ? new Date(coalition.endDate)
      : undefined;

    const votes = await this.fetchLightVotes(dateGte, dateLte);

    for (const vote of votes) {
      if (!vote.date) continue;

      const activeCoalition = coalition || getCoalitionForDate(vote.date);
      if (!activeCoalition) continue;

      const cls = this.classifySingleVote(vote.stemming, activeCoalition);
      totalVotes++;

      if (cls === "coalition") coalitionVotes++;
      else if (cls === "free") freeVotes++;
      else noDataVotes++;
    }

    const effectiveCoalition = coalition || COALITIONS[0];

    this.logger.log(
      `Classified ${totalVotes} votes for ${effectiveCoalition.name}: ` +
        `${coalitionVotes} coalition, ${freeVotes} free, ${noDataVotes} no_data`,
    );

    return {
      coalitionName: effectiveCoalition.name,
      coalitionSlug: effectiveCoalition.slug,
      totalVotes,
      coalitionVotes,
      freeVotes,
      noDataVotes,
    };
  }

  /**
   * Classify votes and return the Set of free-vote IDs (for Vrije Stemmen MCS).
   */
  private async classifyVotesWithFreeIds(
    coalitionSlug: string,
  ): Promise<{
    summary: ClassificationSummary;
    freeVoteIds: Set<string>;
  }> {
    const coalition = getCoalitionBySlug(coalitionSlug);
    if (!coalition) {
      throw new NotFoundException(`Coalition '${coalitionSlug}' not found`);
    }

    const freeVoteIds = new Set<string>();
    let totalVotes = 0;
    let coalitionVotes = 0;
    let freeVotes = 0;
    let noDataVotes = 0;

    const dateGte = new Date(coalition.startDate);
    const dateLte = coalition.endDate
      ? new Date(coalition.endDate)
      : undefined;

    const votes = await this.fetchLightVotes(dateGte, dateLte);

    for (const vote of votes) {
      if (!vote.date) continue;

      const cls = this.classifySingleVote(vote.stemming, coalition);
      totalVotes++;

      if (cls === "coalition") {
        coalitionVotes++;
      } else if (cls === "free") {
        freeVotes++;
        freeVoteIds.add(vote.id);
      } else {
        noDataVotes++;
      }
    }

    this.logger.log(
      `Classified ${totalVotes} votes for ${coalition.name}: ` +
        `${coalitionVotes} coalition, ${freeVotes} free, ${noDataVotes} no_data`,
    );

    return {
      summary: {
        coalitionName: coalition.name,
        coalitionSlug: coalition.slug,
        totalVotes,
        coalitionVotes,
        freeVotes,
        noDataVotes,
      },
      freeVoteIds,
    };
  }

  /**
   * Compute Coalition Alignment Index (CAI) for all tracked parties.
   *
   * CAI = (votes where party voted same as coalition majority) / total votes × 100
   */
  async computeCAI(
    coalitionSlug: string,
  ): Promise<CoalitionAlignmentResult[]> {
    const coalition = getCoalitionBySlug(coalitionSlug);
    if (!coalition) {
      throw new NotFoundException(`Coalition '${coalitionSlug}' not found`);
    }

    const coalitionSet = new Set(coalition.parties);

    const partyStats = new Map<
      string,
      { aligned: number; total: number }
    >();
    for (const p of TRACKED_PARTIES) {
      partyStats.set(p, { aligned: 0, total: 0 });
    }

    const dateGte = new Date(coalition.startDate);
    const dateLte = coalition.endDate
      ? new Date(coalition.endDate)
      : undefined;

    const votes = await this.fetchLightVotes(dateGte, dateLte);

    for (const vote of votes) {
      const stances = this.extractStances(vote.stemming);

      // Determine coalition majority position
      const coalitionPositions: string[] = [];
      for (const p of coalition.parties) {
        const stance = stances.get(p);
        if (stance) coalitionPositions.push(stance);
      }

      if (coalitionPositions.length < 2) continue;

      const forCount = coalitionPositions.filter(
        (s) => s === "FOR",
      ).length;
      const coalitionPosition =
        forCount > coalitionPositions.length / 2 ? "FOR" : "AGAINST";

      for (const party of TRACKED_PARTIES) {
        const stance = stances.get(party);
        if (!stance) continue;

        const stat = partyStats.get(party)!;
        stat.total++;
        if (stance === coalitionPosition) {
          stat.aligned++;
        }
      }
    }

    // Build results — resolve party IDs from DB
    // ABBR_MAP maps DB names → short names; build reverse for lookups
    const reverseAbbrMap = new Map(
      Object.entries(ABBR_MAP).map(([dbName, short]) => [short, dbName]),
    );
    const dbNames = TRACKED_PARTIES.map((p) => reverseAbbrMap.get(p) ?? p);
    const tkParties = await prisma.party.findMany({
      where: {
        abbreviation: { in: [...new Set([...TRACKED_PARTIES, ...dbNames])] },
        parliament: { slug: "tweede-kamer" },
      },
      select: { id: true, abbreviation: true },
    });
    const abbrToId = new Map<string, string>();
    for (const p of tkParties) {
      abbrToId.set(p.abbreviation, p.id);
      // Also map the short name to this ID
      const shortName = ABBR_MAP[p.abbreviation];
      if (shortName) abbrToId.set(shortName, p.id);
    }

    const results: CoalitionAlignmentResult[] = [];

    for (const party of TRACKED_PARTIES) {
      const stat = partyStats.get(party)!;
      if (stat.total === 0) continue;

      results.push({
        partyId: abbrToId.get(party) ?? null,
        abbreviation: party,
        coalitionName: coalition.name,
        coalitionSlug: coalition.slug,
        periodStart: coalition.startDate,
        periodEnd: coalition.endDate ?? new Date().toISOString().split("T")[0],
        totalVotesAnalyzed: stat.total,
        alignedWithCoalition: stat.aligned,
        cai: Math.round((stat.aligned / stat.total) * 100),
        isCoalitionMember: coalitionSet.has(party),
      });
    }

    return results.sort((a, b) => b.cai - a.cai);
  }

  /**
   * Compute Vrije Stemmen MCS — MCS filtered to only "free" votes.
   */
  async getVrijeStemmenMCS(
    partyId: string,
    electionYear: number,
    coalitionSlug?: string,
  ): Promise<VrijeStemmenResult> {
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      select: { abbreviation: true },
    });
    if (!party) {
      throw new NotFoundException(`Party '${partyId}' not found`);
    }

    const slug =
      coalitionSlug ??
      (this.guessCoalitionForYear(electionYear)?.slug || "schoof");

    // 1. Classify votes and get free-vote IDs
    const { summary, freeVoteIds } =
      await this.classifyVotesWithFreeIds(slug);

    // 2. Compute standard MCS (uses precomputed cache when available)
    const standardScorecard = await this.scorecardService.getScorecard(
      partyId,
      { electionYear },
    );

    // 3. Compute Vrije Stemmen MCS (free votes only)
    const freeScorecard = await this.scorecardService.getScorecard(partyId, {
      electionYear,
      voteIdFilter: freeVoteIds,
    });

    const totalMCS = standardScorecard.mandateConsistencyScore;
    const vrijeMCS = freeScorecard.mandateConsistencyScore;

    return {
      partyId,
      abbreviation: party.abbreviation,
      coalitionName: summary.coalitionName,
      coalitionSlug: summary.coalitionSlug,
      electionYear,
      totalMCS,
      vrijeStemmenMCS: vrijeMCS,
      delta: totalMCS - vrijeMCS,
      freeVoteCount: summary.freeVotes,
      coalitionVoteCount: summary.coalitionVotes,
      totalVoteCount: summary.totalVotes,
      scoredPromises: standardScorecard.scoredPromises,
      freeVoteScoredPromises: freeScorecard.scoredPromises,
    };
  }

  // ─── Private helpers ───────────────────────────────────────

  private guessCoalitionForYear(
    electionYear: number,
  ): CoalitionConfig | null {
    if (electionYear >= 2025) return getCoalitionBySlug("jetten");
    return getCoalitionBySlug("schoof");
  }
}
