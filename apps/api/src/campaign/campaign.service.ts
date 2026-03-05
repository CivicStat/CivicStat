import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

export interface ElectionOverviewParty {
  partyId: string;
  abbreviation: string;
  name: string;
  seats: number | null;
  historicalMcs: number | null;       // 2022 MCS
  historicalScoredPromises: number | null;
  historicalTotalPromises: number | null;
  vooruitblikMcs: number | null;      // 2026 MCS
  vooruitblikScoredPromises: number | null;
  vooruitblikTotalPromises: number | null;
  promiseCount2022: number;
  promiseCount2026: number;
}

export interface ElectionOverviewResponse {
  parliamentId: string;
  parliamentName: string;
  parliamentSlug: string;
  electionDate: string;
  parties: ElectionOverviewParty[];
}

@Injectable()
export class CampaignService {
  async getElectionOverview(slug: string): Promise<ElectionOverviewResponse> {
    // Resolve parliament
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      select: { id: true, name: true, shortName: true, slug: true },
    });

    if (!parliament) {
      throw new NotFoundException(`Parliament not found: ${slug}`);
    }

    // Get all parties for this parliament
    const parties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      select: { id: true, abbreviation: true, name: true, seats: true },
    });

    // Get pre-computed scorecards for 2022 + 2026
    const [scorecards2022, scorecards2026] = await Promise.all([
      prisma.precomputedScorecard.findMany({
        where: {
          electionYear: 2022,
          programType: "VERKIEZINGSPROGRAMMA",
          partyId: { in: parties.map((p) => p.id) },
        },
        select: {
          partyId: true,
          mcs: true,
          scoredPromises: true,
          totalPromises: true,
        },
      }),
      prisma.precomputedScorecard.findMany({
        where: {
          electionYear: 2026,
          programType: "VERKIEZINGSPROGRAMMA",
          partyId: { in: parties.map((p) => p.id) },
        },
        select: {
          partyId: true,
          mcs: true,
          scoredPromises: true,
          totalPromises: true,
        },
      }),
    ]);

    // Get promise counts for 2022 + 2026
    const [promiseCounts2022, promiseCounts2026] = await Promise.all([
      prisma.promise.groupBy({
        by: ["programId"],
        where: {
          program: {
            parliamentId: parliament.id,
            electionYear: 2022,
            programType: "VERKIEZINGSPROGRAMMA",
          },
        },
        _count: true,
      }).then(async (grouped) => {
        // Map programId → partyId
        const programs = await prisma.program.findMany({
          where: { id: { in: grouped.map((g) => g.programId) } },
          select: { id: true, partyId: true },
        });
        const programPartyMap = new Map(programs.map((p) => [p.id, p.partyId]));
        const counts = new Map<string, number>();
        for (const g of grouped) {
          const partyId = programPartyMap.get(g.programId);
          if (partyId) counts.set(partyId, (counts.get(partyId) || 0) + g._count);
        }
        return counts;
      }),
      prisma.promise.groupBy({
        by: ["programId"],
        where: {
          program: {
            parliamentId: parliament.id,
            electionYear: 2026,
            programType: "VERKIEZINGSPROGRAMMA",
          },
        },
        _count: true,
      }).then(async (grouped) => {
        const programs = await prisma.program.findMany({
          where: { id: { in: grouped.map((g) => g.programId) } },
          select: { id: true, partyId: true },
        });
        const programPartyMap = new Map(programs.map((p) => [p.id, p.partyId]));
        const counts = new Map<string, number>();
        for (const g of grouped) {
          const partyId = programPartyMap.get(g.programId);
          if (partyId) counts.set(partyId, (counts.get(partyId) || 0) + g._count);
        }
        return counts;
      }),
    ]);

    // Build lookup maps
    const sc2022Map = new Map(scorecards2022.map((s) => [s.partyId, s]));
    const sc2026Map = new Map(scorecards2026.map((s) => [s.partyId, s]));

    // Merge into party overview — only include parties that have at least some data
    const overviewParties: ElectionOverviewParty[] = parties
      .filter((p) => {
        const has2022 = sc2022Map.has(p.id) || (promiseCounts2022.get(p.id) ?? 0) > 0;
        const has2026 = sc2026Map.has(p.id) || (promiseCounts2026.get(p.id) ?? 0) > 0;
        return has2022 || has2026;
      })
      .map((p) => {
        const sc2022 = sc2022Map.get(p.id);
        const sc2026 = sc2026Map.get(p.id);
        return {
          partyId: p.id,
          abbreviation: p.abbreviation,
          name: p.name,
          seats: p.seats,
          historicalMcs: sc2022?.mcs ?? null,
          historicalScoredPromises: sc2022?.scoredPromises ?? null,
          historicalTotalPromises: sc2022?.totalPromises ?? null,
          vooruitblikMcs: sc2026?.mcs ?? null,
          vooruitblikScoredPromises: sc2026?.scoredPromises ?? null,
          vooruitblikTotalPromises: sc2026?.totalPromises ?? null,
          promiseCount2022: promiseCounts2022.get(p.id) ?? 0,
          promiseCount2026: promiseCounts2026.get(p.id) ?? 0,
        };
      })
      .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

    return {
      parliamentId: parliament.id,
      parliamentName: parliament.shortName ?? parliament.name,
      parliamentSlug: parliament.slug,
      electionDate: "2026-03-18",
      parties: overviewParties,
    };
  }
}
