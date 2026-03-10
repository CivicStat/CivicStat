import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

export interface ElectionOverviewParty {
  partyId: string;
  abbreviation: string;
  name: string;
  seats: number | null;
  historicalMcs: number | null;       // 2023 MCS (TK2023)
  historicalScoredPromises: number | null;
  historicalTotalPromises: number | null;
  vooruitblikMcs: number | null;      // 2025 MCS (TK2025)
  vooruitblikScoredPromises: number | null;
  vooruitblikTotalPromises: number | null;
  promiseCount2023: number;
  promiseCount2025: number;
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

    // Get pre-computed scorecards for TK2023 (historical) + TK2025 (vooruitblik)
    const [scorecards2023, scorecards2025] = await Promise.all([
      prisma.precomputedScorecard.findMany({
        where: {
          electionYear: 2023,
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
          electionYear: 2025,
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

    // Get promise counts for TK2023 + TK2025
    const [promiseCounts2023, promiseCounts2025] = await Promise.all([
      prisma.promise.groupBy({
        by: ["programId"],
        where: {
          program: {
            parliamentId: parliament.id,
            electionYear: 2023,
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
            electionYear: 2025,
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
    const sc2023Map = new Map(scorecards2023.map((s) => [s.partyId, s]));
    const sc2025Map = new Map(scorecards2025.map((s) => [s.partyId, s]));

    // Merge into party overview — only include parties that have at least some data
    const overviewParties: ElectionOverviewParty[] = parties
      .filter((p) => {
        const has2023 = sc2023Map.has(p.id) || (promiseCounts2023.get(p.id) ?? 0) > 0;
        const has2025 = sc2025Map.has(p.id) || (promiseCounts2025.get(p.id) ?? 0) > 0;
        return has2023 || has2025;
      })
      .map((p) => {
        const sc2023 = sc2023Map.get(p.id);
        const sc2025 = sc2025Map.get(p.id);
        return {
          partyId: p.id,
          abbreviation: p.abbreviation,
          name: p.name,
          seats: p.seats,
          historicalMcs: sc2023?.mcs ?? null,
          historicalScoredPromises: sc2023?.scoredPromises ?? null,
          historicalTotalPromises: sc2023?.totalPromises ?? null,
          vooruitblikMcs: sc2025?.mcs ?? null,
          vooruitblikScoredPromises: sc2025?.scoredPromises ?? null,
          vooruitblikTotalPromises: sc2025?.totalPromises ?? null,
          promiseCount2023: promiseCounts2023.get(p.id) ?? 0,
          promiseCount2025: promiseCounts2025.get(p.id) ?? 0,
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
