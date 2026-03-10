import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── Scoring constants (same as party scorecard) ──────────
const MATCH_TYPE_WEIGHTS: Record<string, number> = {
  EXPLICIT_MATCH: 1.0,
  IMPLICIT_MATCH: 0.5,
  CONTRADICTS: 1.0,
};

const MIN_MOTIONS_THRESHOLD = 3;

// Period defaults — full voting history from TK2023 election day
const PERIOD_DEFAULTS: Record<number, { start: string; end: string }> = {
  2023: { start: "2023-11-22", end: "2099-12-31" },
  2025: { start: "2023-11-22", end: "2099-12-31" },
};

// ─── Types ────────────────────────────────────────────────
export interface MpPromiseScore {
  promiseId: string;
  promiseCode: string;
  summary: string;
  theme: string;
  expectedDirection: string;
  totalMotionsWithVotes: number;
  alignedVotes: number;
  opposedVotes: number;
  weightedAligned: number;
  weightedOpposed: number;
  noVoteData: number;
  status: "consistent" | "inconsistent" | "mixed" | "insufficient_data";
  /** How the MP's vote was determined for each motion */
  voteSource: "individual" | "party-level" | "mixed";
}

export interface MpScorecard {
  mpId: string;
  mpName: string;
  partyId: string;
  abbreviation: string;
  electionYear: number;
  periodStart: string;
  periodEnd: string;
  totalPromises: number;
  scoredPromises: number;
  insufficientDataPromises: number;
  consistentCount: number;
  inconsistentCount: number;
  mixedCount: number;
  mandateConsistencyScore: number;
  byTheme: Record<string, {
    consistent: number;
    inconsistent: number;
    mixed: number;
    total: number;
    insufficientData: number;
  }>;
  promises?: MpPromiseScore[];
  note: string;
}

export interface MpScorecardSummary {
  mpId: string;
  mpName: string;
  partyId: string;
  abbreviation: string;
  mandateConsistencyScore: number;
  scoredPromises: number;
  consistentCount: number;
  inconsistentCount: number;
  mixedCount: number;
}

@Injectable()
export class MemberScorecardService {
  private readonly logger = new Logger(MemberScorecardService.name);

  /**
   * Compute an individual MP's mandate consistency score.
   *
   * Strategy:
   * 1. Find the MP's party → get party promises for the election year
   * 2. For each promise → motionMatches → votes
   * 3. For each vote:
   *    a. If the MP has an individual VoteRecord (Hoofdelijk): use it directly
   *    b. Else: fall back to party-level rawData.Stemming (Met handopsteken)
   * 4. Score exactly like the party scorecard
   */
  async getScorecard(
    mpIdOrTkId: string,
    options: { electionYear?: number; periodStart?: string; periodEnd?: string } = {},
  ): Promise<MpScorecard> {
    // 1. Find the MP
    const mp = await this.findMp(mpIdOrTkId);
    if (!mp.party) {
      throw new NotFoundException("MP has no party — cannot compute scorecard");
    }

    const party = mp.party;
    const electionYear = options.electionYear ?? 2023;
    const defaults = PERIOD_DEFAULTS[electionYear] ?? PERIOD_DEFAULTS[2023];
    const periodStart = options.periodStart ?? defaults.start;
    const periodEnd = options.periodEnd ?? defaults.end;

    // 2. Find the party's election program
    const program = await prisma.program.findFirst({
      where: { partyId: party.id, electionYear },
    });

    if (!program) {
      return this.emptyScorecard(mp, party, electionYear, periodStart, periodEnd,
        `Geen verkiezingsprogramma gevonden voor ${party.abbreviation} (${electionYear}).`);
    }

    // 3. Get all promises for this program, with motionMatches and votes
    const promises = await prisma.promise.findMany({
      where: { programId: program.id },
      include: {
        motionMatches: {
          include: {
            motion: {
              include: {
                votes: {
                  take: 1,
                  where: {
                    date: {
                      gte: new Date(periodStart),
                      lte: new Date(periodEnd),
                    },
                  },
                  include: {
                    // Get this MP's individual records (if Hoofdelijk vote)
                    records: {
                      where: { mpId: mp.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 4. Score each promise
    const scoredPromises: MpPromiseScore[] = [];
    let consistentCount = 0;
    let inconsistentCount = 0;
    let mixedCount = 0;
    let insufficientDataCount = 0;
    const byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number; insufficientData: number }> = {};

    const partyNames = [party.abbreviation, party.name].filter(Boolean);

    for (const promise of promises) {
      const expectedDir = promise.expectedVoteDirection;
      if (!expectedDir) continue;

      let aligned = 0;
      let opposed = 0;
      let weightedAligned = 0;
      let weightedOpposed = 0;
      let noData = 0;
      let hasIndividual = false;
      let hasPartyLevel = false;

      for (const match of promise.motionMatches) {
        // Skip weak matches
        if (match.confidence < 0.3) continue;

        const matchTypeWeight = MATCH_TYPE_WEIGHTS[match.matchType] ?? 0.5;
        const effectiveWeight = matchTypeWeight * match.confidence;

        const vote = match.motion.votes?.[0];
        if (!vote) { noData++; continue; }

        // Try individual MP record first (Hoofdelijk)
        const mpRecords = vote.records || [];
        let votedFor: boolean | null = null;

        if (mpRecords.length > 0) {
          // MP has individual vote record
          hasIndividual = true;
          const forVotes = mpRecords.filter((r: any) => r.voteValue === "FOR").length;
          const againstVotes = mpRecords.filter((r: any) => r.voteValue === "AGAINST").length;
          if (forVotes === 0 && againstVotes === 0) {
            // MP was absent/abstained — no data
            noData++;
            continue;
          }
          votedFor = forVotes > againstVotes;
        } else {
          // Fall back to party-level rawData.Stemming
          const rawStemmingen = (vote as any).rawData?.Stemming || [];
          const partyVote = rawStemmingen.find(
            (s: any) => partyNames.some((n: string) => s.ActorNaam === n)
          );
          if (!partyVote) { noData++; continue; }
          hasPartyLevel = true;
          votedFor = partyVote.Soort?.toLowerCase() === "voor";
        }

        // CONTRADICTS flips the expected direction
        const expectedFor = match.matchType === "CONTRADICTS"
          ? expectedDir !== "VOOR"
          : expectedDir === "VOOR";

        if (votedFor === expectedFor) {
          aligned++;
          weightedAligned += effectiveWeight;
        } else {
          opposed++;
          weightedOpposed += effectiveWeight;
        }
      }

      const totalMotionsWithVotes = aligned + opposed;
      const theme = promise.theme || "OVERIG";

      if (!byTheme[theme]) {
        byTheme[theme] = { consistent: 0, inconsistent: 0, mixed: 0, total: 0, insufficientData: 0 };
      }
      byTheme[theme].total++;

      let status: MpPromiseScore["status"];
      if (totalMotionsWithVotes < MIN_MOTIONS_THRESHOLD) {
        status = "insufficient_data";
        insufficientDataCount++;
        byTheme[theme].insufficientData++;
      } else {
        const totalWeighted = weightedAligned + weightedOpposed;
        const ratio = totalWeighted > 0 ? weightedAligned / totalWeighted : 0;
        if (ratio >= 0.70) {
          status = "consistent";
          consistentCount++;
          byTheme[theme].consistent++;
        } else if (ratio <= 0.30) {
          status = "inconsistent";
          inconsistentCount++;
          byTheme[theme].inconsistent++;
        } else {
          status = "mixed";
          mixedCount++;
          byTheme[theme].mixed++;
        }
      }

      const voteSource: MpPromiseScore["voteSource"] =
        hasIndividual && hasPartyLevel ? "mixed" :
        hasIndividual ? "individual" : "party-level";

      scoredPromises.push({
        promiseId: promise.id,
        promiseCode: promise.promiseCode,
        summary: promise.summary,
        theme,
        expectedDirection: expectedDir,
        totalMotionsWithVotes,
        alignedVotes: aligned,
        opposedVotes: opposed,
        weightedAligned,
        weightedOpposed,
        noVoteData: noData,
        status,
        voteSource,
      });
    }

    // 5. Compute MCS
    const scoredPromiseCount = consistentCount + inconsistentCount + mixedCount;
    const mcs = scoredPromiseCount > 0
      ? Math.round((consistentCount / scoredPromiseCount) * 100)
      : 0;

    return {
      mpId: mp.id,
      mpName: mp.name,
      partyId: party.id,
      abbreviation: party.abbreviation,
      electionYear,
      periodStart,
      periodEnd,
      totalPromises: promises.length,
      scoredPromises: scoredPromiseCount,
      insufficientDataPromises: insufficientDataCount,
      consistentCount,
      inconsistentCount,
      mixedCount,
      mandateConsistencyScore: mcs,
      byTheme,
      promises: scoredPromises,
      note: this.generateNote(mp, party, scoredPromiseCount, mcs),
    };
  }

  /**
   * Get scorecard summaries for all active MPs (for ranking/comparison).
   */
  async getAllScorecards(options: {
    electionYear?: number;
    party?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: MpScorecardSummary[]; total: number }> {
    const electionYear = options.electionYear ?? 2023;
    const limit = Math.min(options.limit ?? 25, 150);
    const offset = Math.max(options.offset ?? 0, 0);

    // Build MP filter
    const mpWhere: any = { endDate: null }; // Only active MPs
    if (options.party) {
      mpWhere.party = {
        OR: [
          { abbreviation: { equals: options.party, mode: "insensitive" } },
          { name: { equals: options.party, mode: "insensitive" } },
        ],
      };
    }

    const [mps, total] = await Promise.all([
      prisma.mp.findMany({
        where: mpWhere,
        include: {
          party: { select: { id: true, name: true, abbreviation: true } },
        },
        orderBy: { surname: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.mp.count({ where: mpWhere }),
    ]);

    // Compute scorecards in parallel (batched)
    const summaries: MpScorecardSummary[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < mps.length; i += BATCH_SIZE) {
      const batch = mps.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (mp: any) => {
          try {
            const card = await this.getScorecard(mp.id, { electionYear });
            return {
              mpId: mp.id,
              mpName: mp.name,
              partyId: mp.party?.id ?? "",
              abbreviation: mp.party?.abbreviation ?? "?",
              mandateConsistencyScore: card.mandateConsistencyScore,
              scoredPromises: card.scoredPromises,
              consistentCount: card.consistentCount,
              inconsistentCount: card.inconsistentCount,
              mixedCount: card.mixedCount,
            };
          } catch {
            return null;
          }
        })
      );
      summaries.push(...results.filter((r: any): r is MpScorecardSummary => r !== null));
    }

    // Sort by MCS descending
    summaries.sort((a, b) => b.mandateConsistencyScore - a.mandateConsistencyScore);

    return { items: summaries, total };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async findMp(idOrTkId: string) {
    const include = {
      party: {
        select: { id: true, name: true, abbreviation: true, colorNeutral: true },
      },
    };

    const byId = await prisma.mp.findUnique({ where: { id: idOrTkId }, include });
    if (byId) return byId;

    const byTkId = await prisma.mp.findUnique({ where: { tkId: idOrTkId }, include });
    if (!byTkId) throw new NotFoundException("Member not found");
    return byTkId;
  }

  private emptyScorecard(
    mp: any, party: any,
    electionYear: number, periodStart: string, periodEnd: string,
    note: string,
  ): MpScorecard {
    return {
      mpId: mp.id,
      mpName: mp.name,
      partyId: party.id,
      abbreviation: party.abbreviation,
      electionYear,
      periodStart,
      periodEnd,
      totalPromises: 0,
      scoredPromises: 0,
      insufficientDataPromises: 0,
      consistentCount: 0,
      inconsistentCount: 0,
      mixedCount: 0,
      mandateConsistencyScore: 0,
      byTheme: {},
      promises: [],
      note,
    };
  }

  private generateNote(mp: any, party: any, scoredCount: number, mcs: number): string {
    if (scoredCount === 0) {
      return `Onvoldoende stemdata beschikbaar om ${mp.name} (${party.abbreviation}) te scoren.`;
    }
    return `Score voor ${mp.name} (${party.abbreviation}): ${mcs}% op basis van ${scoredCount} beoordeelde beloften. ` +
      `De meeste stemmingen zijn 'met handopsteken' (partijniveau); waar hoofdelijke stemmingen beschikbaar zijn, is het individuele stemgedrag gebruikt.`;
  }
}
