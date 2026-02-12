import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── B2: Match type weights ────────────────────────────────
const MATCH_TYPE_WEIGHTS: Record<string, number> = {
  EXPLICIT_MATCH: 1.0,
  IMPLICIT_MATCH: 0.5,
  CONTRADICTS: 1.0,
};

// ─── B3: Minimum threshold ─────────────────────────────────
const MIN_MOTIONS_THRESHOLD = 3;

export interface PromiseScore {
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
}

export interface PartyScorecard {
  partyId: string;
  abbreviation: string;
  totalPromises: number;
  scoredPromises: number;
  insufficientDataPromises: number;
  consistentCount: number;
  inconsistentCount: number;
  mixedCount: number;
  mandateConsistencyScore: number;
  matchingAlgorithm: string;
  note?: string;
  byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number }>;
  promises: PromiseScore[];
}

@Injectable()
export class PartiesScorecardService {
  async getScorecard(partyIdOrAbbr: string): Promise<PartyScorecard> {
    // 1. Find the party
    const party = await this.findParty(partyIdOrAbbr);

    // 2. Get all promises for this party's 2023 program
    const promises = await prisma.promise.findMany({
      where: {
        program: { partyId: party.id, electionYear: 2023 },
      },
      include: {
        motionMatches: {
          include: {
            motion: {
              include: {
                votes: {
                  take: 1,
                  include: {
                    records: {
                      where: { partyIdSnapshot: party.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 3. Score each promise
    const scoredPromises: PromiseScore[] = [];
    let consistentCount = 0;
    let inconsistentCount = 0;
    let mixedCount = 0;
    let insufficientDataCount = 0;
    const byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number }> = {};

    for (const promise of promises) {
      const expectedDir = promise.expectedVoteDirection;
      if (!expectedDir) continue;

      let aligned = 0;
      let opposed = 0;
      let weightedAligned = 0;
      let weightedOpposed = 0;
      let noData = 0;

      for (const match of promise.motionMatches) {
        // Skip weak matches (confidence < 30%)
        if (match.confidence < 0.3) continue;

        // B2: Confidence-weighted scoring
        const matchTypeWeight = MATCH_TYPE_WEIGHTS[match.matchType] ?? 0.5;
        const effectiveWeight = matchTypeWeight * match.confidence;

        const vote = match.motion.votes?.[0];
        if (!vote) { noData++; continue; }

        // Check party-level vote from individual records
        const partyRecords = vote.records || [];
        let votedFor: boolean | null = null;

        if (partyRecords.length === 0) {
          // Fall back to raw stemming data (party-level "met handopsteken" votes)
          const rawStemmingen = (vote as any).rawData?.Stemming || [];
          const partyNames = [party.abbreviation, party.name].filter(Boolean);
          const partyVote = rawStemmingen.find(
            (s: any) => partyNames.some(n => s.ActorNaam === n)
          );
          if (!partyVote) { noData++; continue; }
          votedFor = partyVote.Soort?.toLowerCase() === "voor";
        } else {
          const forCount = partyRecords.filter((r: any) => r.voteValue === "FOR").length;
          const againstCount = partyRecords.filter((r: any) => r.voteValue === "AGAINST").length;
          votedFor = forCount > againstCount;
        }

        const expectedFor = expectedDir === "VOOR";
        if (votedFor === expectedFor) {
          aligned++;
          weightedAligned += effectiveWeight;
        } else {
          opposed++;
          weightedOpposed += effectiveWeight;
        }
      }

      const totalWithVotes = aligned + opposed;
      const totalWeighted = weightedAligned + weightedOpposed;

      // B3: Minimum threshold — need ≥3 scored motions
      let status: PromiseScore["status"] = "insufficient_data";
      if (totalWithVotes >= MIN_MOTIONS_THRESHOLD && totalWeighted > 0) {
        const ratio = weightedAligned / totalWeighted;
        // B2: Updated thresholds (70/30 instead of 60/40)
        if (ratio >= 0.70) status = "consistent";
        else if (ratio <= 0.30) status = "inconsistent";
        else status = "mixed";
      }

      // Track by theme
      if (!byTheme[promise.theme]) {
        byTheme[promise.theme] = { consistent: 0, inconsistent: 0, mixed: 0, total: 0 };
      }
      if (status !== "insufficient_data") {
        byTheme[promise.theme].total++;
        byTheme[promise.theme][status]++;
      }

      if (status === "consistent") consistentCount++;
      else if (status === "inconsistent") inconsistentCount++;
      else if (status === "mixed") mixedCount++;
      else insufficientDataCount++;

      scoredPromises.push({
        promiseId: promise.id,
        promiseCode: promise.promiseCode,
        summary: promise.summary,
        theme: promise.theme,
        expectedDirection: expectedDir,
        totalMotionsWithVotes: totalWithVotes,
        alignedVotes: aligned,
        opposedVotes: opposed,
        weightedAligned: Math.round(weightedAligned * 100) / 100,
        weightedOpposed: Math.round(weightedOpposed * 100) / 100,
        noVoteData: noData,
        status,
      });
    }

    // B4: Sample-size weighted aggregate MCS
    const scored = scoredPromises.filter(p => p.status !== "insufficient_data");
    let weightedConsistencySum = 0;
    let totalMotionWeight = 0;

    for (const p of scored) {
      const weight = p.totalMotionsWithVotes; // more matches = more influence
      const totalW = p.weightedAligned + p.weightedOpposed;
      const ratio = totalW > 0 ? p.weightedAligned / totalW : 0;
      weightedConsistencySum += ratio * weight;
      totalMotionWeight += weight;
    }

    const mandateConsistencyScore = totalMotionWeight > 0
      ? Math.round((weightedConsistencySum / totalMotionWeight) * 100)
      : 0;

    return {
      partyId: party.id,
      abbreviation: party.abbreviation,
      totalPromises: promises.length,
      scoredPromises: scored.length,
      insufficientDataPromises: insufficientDataCount,
      consistentCount,
      inconsistentCount,
      mixedCount,
      mandateConsistencyScore,
      matchingAlgorithm: 'keyword-overlap-v2',
      note: scored.length < promises.length
        ? `${insufficientDataCount} belofte(n) hebben onvoldoende data (< ${MIN_MOTIONS_THRESHOLD} moties)`
        : undefined,
      byTheme,
      promises: scoredPromises,
    };
  }

  async getAllScorecards(): Promise<Omit<PartyScorecard, "promises">[]> {
    const partiesWithPromises = await prisma.$queryRaw<{ party_id: string }[]>`
      SELECT DISTINCT prog.party_id
      FROM promises p
      JOIN programs prog ON p.program_id = prog.id
      WHERE prog.election_year = 2023
    `;

    const scorecards = [];
    for (const { party_id } of partiesWithPromises) {
      try {
        const full = await this.getScorecard(party_id);
        const { promises, ...summary } = full;
        scorecards.push(summary);
      } catch (err) {
        console.error(`Scorecard failed for ${party_id}:`, err);
      }
    }

    return scorecards.sort((a, b) => b.mandateConsistencyScore - a.mandateConsistencyScore);
  }

  private async findParty(idOrAbbr: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrAbbr);

    if (isUuid) {
      const byId = await prisma.party.findUnique({ where: { id: idOrAbbr } });
      if (byId) return byId;
    }

    const byTkId = await prisma.party.findUnique({ where: { tkId: idOrAbbr } });
    if (byTkId) return byTkId;

    const byAbbr = await prisma.party.findFirst({
      where: { abbreviation: { equals: idOrAbbr, mode: "insensitive" } },
    });
    if (byAbbr) return byAbbr;

    throw new NotFoundException("Party not found");
  }
}
