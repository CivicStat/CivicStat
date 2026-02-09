import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

export interface PromiseScore {
  promiseId: string;
  promiseCode: string;
  summary: string;
  theme: string;
  expectedDirection: string; // "VOOR" or "TEGEN"
  totalMotionsWithVotes: number;
  alignedVotes: number;    // Party voted in expected direction
  opposedVotes: number;    // Party voted against expected direction
  noVoteData: number;      // No party-level vote data available
  status: "consistent" | "inconsistent" | "mixed" | "insufficient_data";
}

export interface PartyScorecard {
  partyId: string;
  abbreviation: string;
  totalPromises: number;
  scoredPromises: number;  // promises with enough vote data
  consistentCount: number;
  inconsistentCount: number;
  mixedCount: number;
  mandateConsistencyScore: number; // 0-100
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
    const byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number }> = {};

    for (const promise of promises) {
      const expectedDir = promise.expectedVoteDirection; // "VOOR" or "TEGEN"
      if (!expectedDir) continue;

      let aligned = 0;
      let opposed = 0;
      let noData = 0;

      for (const match of promise.motionMatches) {
        const vote = match.motion.votes?.[0];
        if (!vote) { noData++; continue; }

        // Check party-level vote from individual records
        const partyRecords = vote.records || [];
        if (partyRecords.length === 0) {
          // Fall back to raw stemming data (party-level "met handopsteken" votes)
          const rawStemmingen = (vote as any).rawData?.Stemming || [];
          const partyVote = rawStemmingen.find(
            (s: any) => s.ActorNaam === party.abbreviation
          );
          if (!partyVote) { noData++; continue; }

          const votedFor = partyVote.Soort?.toLowerCase() === "voor";
          const expectedFor = expectedDir === "VOOR";
          if (votedFor === expectedFor) aligned++;
          else opposed++;
        } else {
          // Count individual MP votes for this party
          const forCount = partyRecords.filter((r: any) => r.voteValue === "FOR").length;
          const againstCount = partyRecords.filter((r: any) => r.voteValue === "AGAINST").length;
          const majorityFor = forCount > againstCount;
          const expectedFor = expectedDir === "VOOR";
          if (majorityFor === expectedFor) aligned++;
          else opposed++;
        }
      }

      const totalWithVotes = aligned + opposed;
      let status: PromiseScore["status"] = "insufficient_data";
      if (totalWithVotes >= 1) {
        const ratio = aligned / totalWithVotes;
        if (ratio >= 0.6) status = "consistent";
        else if (ratio <= 0.4) status = "inconsistent";
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

      scoredPromises.push({
        promiseId: promise.id,
        promiseCode: promise.promiseCode,
        summary: promise.summary,
        theme: promise.theme,
        expectedDirection: expectedDir,
        totalMotionsWithVotes: totalWithVotes,
        alignedVotes: aligned,
        opposedVotes: opposed,
        noVoteData: noData,
        status,
      });
    }

    const scoredCount = consistentCount + inconsistentCount + mixedCount;
    const mandateConsistencyScore = scoredCount > 0
      ? Math.round(((consistentCount + mixedCount * 0.5) / scoredCount) * 100)
      : 0;

    return {
      partyId: party.id,
      abbreviation: party.abbreviation,
      totalPromises: promises.length,
      scoredPromises: scoredCount,
      consistentCount,
      inconsistentCount,
      mixedCount,
      mandateConsistencyScore,
      byTheme,
      promises: scoredPromises,
    };
  }

  async getAllScorecards(): Promise<Omit<PartyScorecard, "promises">[]> {
    // Get all parties that have promises
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
    const byId = await prisma.party.findUnique({ where: { id: idOrAbbr } });
    if (byId) return byId;

    const byTkId = await prisma.party.findUnique({ where: { tkId: idOrAbbr } });
    if (byTkId) return byTkId;

    const byAbbr = await prisma.party.findFirst({
      where: { abbreviation: { equals: idOrAbbr, mode: "insensitive" } },
    });
    if (byAbbr) return byAbbr;

    throw new NotFoundException("Party not found");
  }
}
