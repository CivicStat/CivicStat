import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";
import { COALITIONS, CoalitionConfig } from "../coalitions/coalitions.config";

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

  /**
   * Campaign landing page: combines scorecards, top promises, and coalition info
   * for a parliament-scoped election campaign page.
   */
  async getCampaignLanding(slug: string) {
    // Resolve parliament
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      select: { id: true, name: true, shortName: true, slug: true },
    });

    if (!parliament) {
      throw new NotFoundException(`Parliament not found: ${slug}`);
    }

    // Get parties with scorecards
    const parties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      select: {
        id: true,
        abbreviation: true,
        name: true,
        seats: true,
        colorNeutral: true,
      },
    });

    const partyIds = parties.map((p) => p.id);

    // Parallel: scorecards, top promises per party, active coalition
    const [scorecards, topPromises] = await Promise.all([
      // Pre-computed scorecards (2023 historical)
      prisma.precomputedScorecard.findMany({
        where: {
          partyId: { in: partyIds },
          programType: "VERKIEZINGSPROGRAMMA",
        },
        select: {
          partyId: true,
          electionYear: true,
          mcs: true,
          scoredPromises: true,
          totalPromises: true,
        },
        orderBy: { electionYear: "desc" },
      }),

      // Top 3 promises per party (most matched, with expected direction)
      prisma.promise.findMany({
        where: {
          program: {
            partyId: { in: partyIds },
            parliamentId: parliament.id,
            programType: "VERKIEZINGSPROGRAMMA",
          },
          expectedVoteDirection: { not: null },
        },
        select: {
          id: true,
          text: true,
          theme: true,
          specificity: true,
          expectedVoteDirection: true,
          program: {
            select: {
              partyId: true,
              electionYear: true,
            },
          },
          _count: {
            select: { motionMatches: true },
          },
        },
        orderBy: {
          motionMatches: { _count: "desc" },
        },
      }),
    ]);

    // Group scorecards by party
    const scorecardsByParty = new Map<string, { electionYear: number; mcs: number | null; scoredPromises: number | null; totalPromises: number | null }[]>();
    for (const sc of scorecards) {
      const list = scorecardsByParty.get(sc.partyId) ?? [];
      list.push({
        electionYear: sc.electionYear,
        mcs: sc.mcs,
        scoredPromises: sc.scoredPromises,
        totalPromises: sc.totalPromises,
      });
      scorecardsByParty.set(sc.partyId, list);
    }

    // Group top promises by party (take top 3 per party)
    const promisesByParty = new Map<string, typeof topPromises>();
    for (const p of topPromises) {
      const partyId = p.program.partyId;
      const list = promisesByParty.get(partyId) ?? [];
      if (list.length < 3) list.push(p);
      promisesByParty.set(partyId, list);
    }

    // Find active coalition
    const now = new Date();
    const activeCoalition = COALITIONS.find((c) => {
      const start = new Date(c.startDate);
      const end = c.endDate ? new Date(c.endDate) : new Date("2099-12-31");
      return now >= start && now <= end;
    }) ?? null;

    // Build party campaign data
    const campaignParties = parties
      .filter((p) => scorecardsByParty.has(p.id) || promisesByParty.has(p.id))
      .map((p) => ({
        partyId: p.id,
        abbreviation: p.abbreviation,
        name: p.name,
        seats: p.seats ?? 0,
        colorNeutral: p.colorNeutral,
        isCoalition: activeCoalition?.parties.includes(p.abbreviation) ?? false,
        scorecards: scorecardsByParty.get(p.id) ?? [],
        topPromises: (promisesByParty.get(p.id) ?? []).map((pr) => ({
          id: pr.id,
          text: pr.text,
          theme: pr.theme,
          specificity: pr.specificity,
          expectedVoteDirection: pr.expectedVoteDirection,
          matchCount: pr._count.motionMatches,
          electionYear: pr.program.electionYear,
        })),
      }))
      .sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));

    return {
      parliamentId: parliament.id,
      parliamentName: parliament.shortName ?? parliament.name,
      parliamentSlug: parliament.slug,
      electionDate: "2026-03-18",
      coalition: activeCoalition
        ? {
            name: activeCoalition.name,
            slug: activeCoalition.slug,
            parties: activeCoalition.parties,
            startDate: activeCoalition.startDate,
            endDate: activeCoalition.endDate,
          }
        : null,
      parties: campaignParties,
    };
  }

  /**
   * Side-by-side comparison of 2+ parties on promises, MCS scores,
   * voting alignment per theme, and pairwise vote agreement.
   *
   * GET /parliament/:slug/parties/compare?partyIds=id1,id2&year=2026
   */
  async compareParties(slug: string, partyIds: string[], year?: number) {
    if (partyIds.length < 2) {
      throw new BadRequestException("At least two partyIds are required");
    }
    if (partyIds.length > 6) {
      throw new BadRequestException("Maximum 6 parties for comparison");
    }

    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      select: { id: true, name: true, shortName: true, slug: true },
    });
    if (!parliament) {
      throw new NotFoundException(`Parliament not found: ${slug}`);
    }

    // Resolve parties — accept both UUIDs and abbreviations
    const parties = await prisma.party.findMany({
      where: {
        parliamentId: parliament.id,
        OR: [
          { id: { in: partyIds } },
          { abbreviation: { in: partyIds, mode: "insensitive" } },
        ],
      },
      select: { id: true, abbreviation: true, name: true, seats: true, colorNeutral: true },
    });

    if (parties.length < 2) {
      throw new NotFoundException(
        `Found only ${parties.length} of ${partyIds.length} parties in ${slug}`,
      );
    }

    const resolvedIds = parties.map((p) => p.id);

    // Parallel data fetches
    const [scorecards, promises, voteRecords] = await Promise.all([
      // Pre-computed scorecards
      prisma.precomputedScorecard.findMany({
        where: {
          partyId: { in: resolvedIds },
          programType: "VERKIEZINGSPROGRAMMA",
          ...(year ? { electionYear: year } : {}),
        },
        orderBy: { electionYear: "desc" },
      }),

      // Promise counts grouped by theme
      prisma.promise.findMany({
        where: {
          program: {
            partyId: { in: resolvedIds },
            parliamentId: parliament.id,
            programType: "VERKIEZINGSPROGRAMMA",
            ...(year ? { electionYear: year } : {}),
          },
        },
        select: {
          theme: true,
          program: { select: { partyId: true } },
        },
      }),

      // Vote records for pairwise agreement (all shared votes in this parliament)
      prisma.voteRecord.findMany({
        where: {
          partyIdSnapshot: { in: resolvedIds },
          vote: { parliamentId: parliament.id },
          voteValue: { in: ["FOR", "AGAINST"] },
        },
        select: {
          voteId: true,
          partyIdSnapshot: true,
          voteValue: true,
        },
      }),
    ]);

    // Build per-party scorecard + theme data
    const scorecardMap = new Map<string, typeof scorecards>();
    for (const sc of scorecards) {
      const list = scorecardMap.get(sc.partyId) ?? [];
      list.push(sc);
      scorecardMap.set(sc.partyId, list);
    }

    // Promise theme distribution per party
    const themesByParty = new Map<string, Record<string, number>>();
    const allThemes = new Set<string>();
    for (const p of promises) {
      const partyId = p.program.partyId;
      const themes = themesByParty.get(partyId) ?? {};
      themes[p.theme] = (themes[p.theme] || 0) + 1;
      themesByParty.set(partyId, themes);
      allThemes.add(p.theme);
    }

    // Build party comparison entries
    const comparedParties = parties.map((party) => {
      const scs = scorecardMap.get(party.id) ?? [];
      const latestSc = scs[0]; // Already ordered desc
      const detail = latestSc?.detailJson as any;
      const promiseThemes = themesByParty.get(party.id) ?? {};

      return {
        partyId: party.id,
        abbreviation: party.abbreviation,
        name: party.name,
        seats: party.seats,
        colorNeutral: party.colorNeutral,
        mandateConsistencyScore: latestSc?.mcs ?? null,
        electionYear: latestSc?.electionYear ?? null,
        totalPromises: latestSc?.totalPromises ?? Object.values(promiseThemes).reduce((a, b) => a + b, 0),
        scoredPromises: latestSc?.scoredPromises ?? null,
        byTheme: detail?.byTheme ?? null,
        promisesByTheme: promiseThemes,
      };
    });

    // Pairwise vote agreement
    // Group vote records: voteId → partyId → voteValue
    const voteMap = new Map<string, Map<string, string>>();
    for (const vr of voteRecords) {
      let partyVotes = voteMap.get(vr.voteId);
      if (!partyVotes) {
        partyVotes = new Map();
        voteMap.set(vr.voteId, partyVotes);
      }
      partyVotes.set(vr.partyIdSnapshot, vr.voteValue);
    }

    // Compute pairwise agreement for all party pairs
    const pairs: { party1: string; party2: string; sharedVotes: number; agreed: number; agreementRate: number }[] = [];
    for (let i = 0; i < parties.length; i++) {
      for (let j = i + 1; j < parties.length; j++) {
        const p1 = parties[i];
        const p2 = parties[j];
        let shared = 0;
        let agreed = 0;

        for (const [, partyVotes] of voteMap) {
          const v1 = partyVotes.get(p1.id);
          const v2 = partyVotes.get(p2.id);
          if (v1 && v2) {
            shared++;
            if (v1 === v2) agreed++;
          }
        }

        pairs.push({
          party1: p1.abbreviation,
          party2: p2.abbreviation,
          sharedVotes: shared,
          agreed,
          agreementRate: shared > 0 ? Math.round((agreed / shared) * 100) : 0,
        });
      }
    }

    return {
      parliamentId: parliament.id,
      parliamentName: parliament.shortName ?? parliament.name,
      parliamentSlug: parliament.slug,
      themes: [...allThemes].sort(),
      parties: comparedParties,
      voteAgreement: {
        pairs: pairs.sort((a, b) => b.agreementRate - a.agreementRate),
      },
    };
  }
}
