import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";
import { COALITIONS, CoalitionConfig, getCoalitionForDate } from "../coalitions/coalitions.config";

export interface ElectionOverviewParty {
  partyId: string;
  abbreviation: string;
  name: string;
  seats: number | null;
  historicalMcs: number | null;
  historicalScoredPromises: number | null;
  historicalTotalPromises: number | null;
  vooruitblikMcs: number | null;
  vooruitblikScoredPromises: number | null;
  vooruitblikTotalPromises: number | null;
  promiseCountHistorical: number;
  promiseCountCurrent: number;
  coalitionStatus: "coalitie" | "oppositie" | null;
  // Aliases for backwards compat with frontend
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
      select: { id: true, name: true, shortName: true, slug: true, level: true },
    });

    if (!parliament) {
      throw new NotFoundException(`Parliament not found: ${slug}`);
    }

    // Municipal elections use different year cycle: 2022 (historical) + 2026 (current)
    // National elections: 2023 (historical) + 2025 (current)
    const isMunicipal = parliament.level === "MUNICIPAL";
    const historicalYear = isMunicipal ? 2022 : 2023;
    const currentYear = isMunicipal ? 2026 : 2025;

    // Get all parties for this parliament
    const parties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      select: { id: true, abbreviation: true, name: true, seats: true },
    });

    const partyIds = parties.map((p) => p.id);

    // Get pre-computed scorecards for historical + current year
    const [scorecardsHistorical, scorecardsCurrent] = await Promise.all([
      prisma.precomputedScorecard.findMany({
        where: {
          electionYear: historicalYear,
          programType: "VERKIEZINGSPROGRAMMA",
          partyId: { in: partyIds },
        },
        select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
      }),
      prisma.precomputedScorecard.findMany({
        where: {
          electionYear: currentYear,
          programType: "VERKIEZINGSPROGRAMMA",
          partyId: { in: partyIds },
        },
        select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
      }),
    ]);

    // Helper to count promises by year
    const countPromisesByYear = async (year: number) => {
      const grouped = await prisma.promise.groupBy({
        by: ["programId"],
        where: {
          program: {
            parliamentId: parliament.id,
            electionYear: year,
            programType: "VERKIEZINGSPROGRAMMA",
          },
        },
        _count: true,
      });
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
    };

    const [promiseCountsHistorical, promiseCountsCurrent] = await Promise.all([
      countPromisesByYear(historicalYear),
      countPromisesByYear(currentYear),
    ]);

    // Build lookup maps
    const scHistMap = new Map(scorecardsHistorical.map((s) => [s.partyId, s]));
    const scCurMap = new Map(scorecardsCurrent.map((s) => [s.partyId, s]));

    // Determine coalition status for each party
    const coalition = getCoalitionForDate(new Date());

    // Merge into party overview — only include parties that have at least some data
    const overviewParties: ElectionOverviewParty[] = parties
      .filter((p) => {
        const hasHistorical = scHistMap.has(p.id) || (promiseCountsHistorical.get(p.id) ?? 0) > 0;
        const hasCurrent = scCurMap.has(p.id) || (promiseCountsCurrent.get(p.id) ?? 0) > 0;
        return hasHistorical || hasCurrent;
      })
      .map((p) => {
        const scHist = scHistMap.get(p.id);
        const scCur = scCurMap.get(p.id);
        const countHist = promiseCountsHistorical.get(p.id) ?? 0;
        const countCur = promiseCountsCurrent.get(p.id) ?? 0;
        return {
          partyId: p.id,
          abbreviation: p.abbreviation,
          name: p.name,
          seats: p.seats,
          historicalMcs: scHist?.mcs ?? null,
          historicalScoredPromises: scHist?.scoredPromises ?? null,
          historicalTotalPromises: scHist?.totalPromises ?? null,
          vooruitblikMcs: scCur?.mcs ?? null,
          vooruitblikScoredPromises: scCur?.scoredPromises ?? null,
          vooruitblikTotalPromises: scCur?.totalPromises ?? null,
          promiseCountHistorical: countHist,
          promiseCountCurrent: countCur,
          coalitionStatus: coalition ? (coalition.parties.includes(p.abbreviation) ? "coalitie" as const : "oppositie" as const) : null,
          promiseCount2022: countHist,
          promiseCount2026: countCur,
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
   * Post-election uitslag for a single municipality.
   * Shows all parties with seats (when available), MCS scores,
   * and national party comparison.
   */
  async getUitslag2026(slug: string) {
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      select: { id: true, name: true, shortName: true, slug: true, level: true },
    });
    if (!parliament) throw new NotFoundException(`Parliament not found: ${slug}`);
    if (parliament.level !== "MUNICIPAL") {
      throw new BadRequestException("Uitslag endpoint is only for municipal parliaments");
    }

    // Get parties with seats
    const parties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      select: { id: true, abbreviation: true, name: true, seats: true, colorNeutral: true },
    });

    const partyIds = parties.map((p) => p.id);

    // Parallel: scorecards for 2026 + national party links
    const [scorecards2026, scorecards2022, nationalParties] = await Promise.all([
      prisma.precomputedScorecard.findMany({
        where: { partyId: { in: partyIds }, electionYear: 2026, programType: "VERKIEZINGSPROGRAMMA" },
        select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
      }),
      prisma.precomputedScorecard.findMany({
        where: { partyId: { in: partyIds }, electionYear: 2022, programType: "VERKIEZINGSPROGRAMMA" },
        select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
      }),
      // National party MCS for comparison — find TK parties matching abbreviations
      this.getNationalPartyScores(parties.map((p) => p.abbreviation)),
    ]);

    const sc2026Map = new Map(scorecards2026.map((s) => [s.partyId, s]));
    const sc2022Map = new Map(scorecards2022.map((s) => [s.partyId, s]));

    // Build result
    const totalSeats = parties.reduce((sum, p) => sum + (p.seats ?? 0), 0);
    const hasSeats = totalSeats > 0;

    const partyResults = parties
      .filter((p) => sc2026Map.has(p.id) || sc2022Map.has(p.id) || (p.seats ?? 0) > 0)
      .map((p) => {
        const sc2026 = sc2026Map.get(p.id);
        const sc2022 = sc2022Map.get(p.id);
        const nationalMcs = nationalParties.get(p.abbreviation) ?? null;

        return {
          partyId: p.id,
          abbreviation: p.abbreviation,
          name: p.name,
          colorNeutral: p.colorNeutral,
          seats: p.seats,
          mcs2026: sc2026?.mcs ?? null,
          scoredPromises2026: sc2026?.scoredPromises ?? null,
          totalPromises2026: sc2026?.totalPromises ?? null,
          mcs2022: sc2022?.mcs ?? null,
          nationalMcs,
          mcsChange: sc2026?.mcs != null && sc2022?.mcs != null
            ? sc2026.mcs - sc2022.mcs
            : null,
        };
      })
      .sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));

    const winner = hasSeats ? partyResults[0] ?? null : null;

    return {
      parliamentId: parliament.id,
      parliamentName: parliament.shortName ?? parliament.name,
      parliamentSlug: parliament.slug,
      electionDate: "2026-03-18",
      resultsAvailable: hasSeats,
      totalSeats,
      winner: winner ? {
        abbreviation: winner.abbreviation,
        name: winner.name,
        seats: winner.seats,
        mcs: winner.mcs2026,
        nationalMcs: winner.nationalMcs,
      } : null,
      parties: partyResults,
    };
  }

  /**
   * Cross-municipality overview of 2026 election results.
   * Shows all 4 municipal parliaments with their winner and top party MCS scores.
   */
  async getUitslagOverview2026() {
    const municipalities = await prisma.parliament.findMany({
      where: { level: "MUNICIPAL", active: true },
      select: { id: true, slug: true, name: true, shortName: true },
      orderBy: { name: "asc" },
    });

    const results = await Promise.all(
      municipalities.map(async (muni) => {
        const parties = await prisma.party.findMany({
          where: { parliamentId: muni.id },
          select: { id: true, abbreviation: true, name: true, seats: true, colorNeutral: true },
        });

        const partyIds = parties.map((p) => p.id);
        const scorecards = await prisma.precomputedScorecard.findMany({
          where: { partyId: { in: partyIds }, electionYear: 2026, programType: "VERKIEZINGSPROGRAMMA" },
          select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
        });

        const scMap = new Map(scorecards.map((s) => [s.partyId, s]));
        const totalSeats = parties.reduce((sum, p) => sum + (p.seats ?? 0), 0);
        const hasSeats = totalSeats > 0;

        const sortedParties = parties
          .map((p) => ({
            abbreviation: p.abbreviation,
            name: p.name,
            seats: p.seats,
            colorNeutral: p.colorNeutral,
            mcs: scMap.get(p.id)?.mcs ?? null,
          }))
          .sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));

        const winner = hasSeats ? sortedParties[0] : null;

        return {
          slug: muni.slug,
          name: muni.shortName ?? muni.name,
          totalSeats,
          resultsAvailable: hasSeats,
          winner,
          parties: sortedParties.filter((p) => p.mcs != null || (p.seats ?? 0) > 0),
        };
      }),
    );

    return {
      electionDate: "2026-03-18",
      municipalities: results,
    };
  }

  /**
   * Seed election results — update party seats for a municipality.
   */
  async seedElectionResults(slug: string, results: { abbreviation: string; seats: number }[]) {
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      select: { id: true, level: true },
    });
    if (!parliament) throw new NotFoundException(`Parliament not found: ${slug}`);
    if (parliament.level !== "MUNICIPAL") {
      throw new BadRequestException("Only municipal parliaments can have election results seeded");
    }

    const updated: { abbreviation: string; seats: number }[] = [];
    for (const result of results) {
      const party = await prisma.party.findFirst({
        where: {
          parliamentId: parliament.id,
          abbreviation: { equals: result.abbreviation, mode: "insensitive" },
        },
      });
      if (party) {
        await prisma.party.update({
          where: { id: party.id },
          data: { seats: result.seats },
        });
        updated.push({ abbreviation: party.abbreviation, seats: result.seats });
      }
    }

    return { slug, updated, total: updated.length };
  }

  /**
   * Post-election analysis: compare pre-election MCS scores with actual
   * election outcomes (seat changes) and identify whether voters rewarded
   * or punished promise consistency.
   *
   * GET /parliament/:slug/uitslag-analyse
   */
  async getUitslagAnalyse(slug: string) {
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      select: { id: true, name: true, shortName: true, slug: true, level: true },
    });
    if (!parliament) throw new NotFoundException(`Parliament not found: ${slug}`);
    if (parliament.level !== "MUNICIPAL") {
      throw new BadRequestException("Uitslag-analyse is only for municipal parliaments");
    }

    const parties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      select: { id: true, abbreviation: true, name: true, seats: true, colorNeutral: true },
    });

    const partyIds = parties.map((p) => p.id);

    // Get 2022 (pre-election historical) + 2026 (current cycle) scorecards
    const [scorecards2022, scorecards2026] = await Promise.all([
      prisma.precomputedScorecard.findMany({
        where: { partyId: { in: partyIds }, electionYear: 2022, programType: "VERKIEZINGSPROGRAMMA" },
        select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
      }),
      prisma.precomputedScorecard.findMany({
        where: { partyId: { in: partyIds }, electionYear: 2026, programType: "VERKIEZINGSPROGRAMMA" },
        select: { partyId: true, mcs: true, scoredPromises: true, totalPromises: true },
      }),
    ]);

    const sc2022Map = new Map(scorecards2022.map((s) => [s.partyId, s]));
    const sc2026Map = new Map(scorecards2026.map((s) => [s.partyId, s]));

    // Use 2022 MCS as "pre-election" where available, fallback to 2026
    const totalSeats = parties.reduce((sum, p) => sum + (p.seats ?? 0), 0);

    const partyAnalyses = parties
      .filter((p) => (p.seats ?? 0) > 0 || sc2022Map.has(p.id) || sc2026Map.has(p.id))
      .map((p) => {
        const preElectionMcs = sc2022Map.get(p.id)?.mcs ?? sc2026Map.get(p.id)?.mcs ?? null;
        const currentMcs = sc2026Map.get(p.id)?.mcs ?? null;
        const seatShare = totalSeats > 0 ? Math.round(((p.seats ?? 0) / totalSeats) * 100) : 0;

        return {
          partyId: p.id,
          abbreviation: p.abbreviation,
          name: p.name,
          colorNeutral: p.colorNeutral,
          seats: p.seats ?? 0,
          seatShare,
          preElectionMcs,
          currentMcs,
          mcsChange: preElectionMcs != null && currentMcs != null ? currentMcs - preElectionMcs : null,
          scoredPromises: sc2026Map.get(p.id)?.scoredPromises ?? null,
          totalPromises: sc2026Map.get(p.id)?.totalPromises ?? null,
        };
      })
      .sort((a, b) => b.seats - a.seats);

    // Compute "belonende kiezers" correlation
    // Compare: did parties with higher MCS win more seats (seat share)?
    const withMcsAndSeats = partyAnalyses.filter(
      (p) => p.preElectionMcs != null && p.seats > 0,
    );

    let correlation: { direction: "positive" | "negative" | "neutral"; strength: string; note: string } | null = null;
    const findings: { type: string; party: string; note: string }[] = [];

    if (withMcsAndSeats.length >= 3) {
      // Spearman-like rank correlation between MCS and seat share
      const sorted = [...withMcsAndSeats].sort((a, b) => b.preElectionMcs! - a.preElectionMcs!);
      const mcsRanks = new Map(sorted.map((p, i) => [p.partyId, i + 1]));
      const seatSorted = [...withMcsAndSeats].sort((a, b) => b.seatShare - a.seatShare);
      const seatRanks = new Map(seatSorted.map((p, i) => [p.partyId, i + 1]));

      const n = withMcsAndSeats.length;
      let sumD2 = 0;
      for (const p of withMcsAndSeats) {
        const d = (mcsRanks.get(p.partyId) ?? 0) - (seatRanks.get(p.partyId) ?? 0);
        sumD2 += d * d;
      }
      const rho = 1 - (6 * sumD2) / (n * (n * n - 1));

      const direction = rho > 0.3 ? "positive" : rho < -0.3 ? "negative" : "neutral";
      const strength = Math.abs(rho) > 0.6 ? "sterk" : Math.abs(rho) > 0.3 ? "matig" : "zwak";

      correlation = {
        direction,
        strength,
        note: direction === "positive"
          ? `Er is een ${strength} positief verband (rho=${rho.toFixed(2)}) tussen MCS en verkiezingsresultaat: betrouwbaardere partijen wonnen meer zetels.`
          : direction === "negative"
            ? `Er is een ${strength} negatief verband (rho=${rho.toFixed(2)}): partijen met lagere MCS wonnen juist meer zetels.`
            : `Er is geen duidelijk verband (rho=${rho.toFixed(2)}) tussen MCS en verkiezingsresultaat.`,
      };
    }

    // Generate key findings
    const winner = partyAnalyses[0];
    if (winner && winner.preElectionMcs != null) {
      const avgMcs = withMcsAndSeats.length > 0
        ? Math.round(withMcsAndSeats.reduce((s, p) => s + p.preElectionMcs!, 0) / withMcsAndSeats.length)
        : null;

      findings.push({
        type: "winner_mcs",
        party: winner.abbreviation,
        note: winner.preElectionMcs >= (avgMcs ?? 50)
          ? `Winnaar ${winner.abbreviation} (${winner.seats} zetels) had een bovengemiddelde MCS van ${winner.preElectionMcs}%.`
          : `Winnaar ${winner.abbreviation} (${winner.seats} zetels) had een ondergemiddelde MCS van ${winner.preElectionMcs}%.`,
      });
    }

    // High-MCS parties that won few seats (underperformers)
    const highMcsLowSeats = withMcsAndSeats
      .filter((p) => p.preElectionMcs! >= 65 && p.seatShare < 8)
      .sort((a, b) => b.preElectionMcs! - a.preElectionMcs!);
    for (const p of highMcsLowSeats.slice(0, 2)) {
      findings.push({
        type: "high_mcs_low_seats",
        party: p.abbreviation,
        note: `${p.abbreviation} had hoge MCS (${p.preElectionMcs}%) maar won slechts ${p.seats} zetel${p.seats === 1 ? "" : "s"} (${p.seatShare}%).`,
      });
    }

    // Low-MCS parties that won many seats (overperformers)
    const lowMcsHighSeats = withMcsAndSeats
      .filter((p) => p.preElectionMcs! < 50 && p.seatShare >= 10)
      .sort((a, b) => a.preElectionMcs! - b.preElectionMcs!);
    for (const p of lowMcsHighSeats.slice(0, 2)) {
      findings.push({
        type: "low_mcs_high_seats",
        party: p.abbreviation,
        note: `${p.abbreviation} had lage MCS (${p.preElectionMcs}%) maar won ${p.seats} zetels (${p.seatShare}%).`,
      });
    }

    // MCS change leaders
    const biggestRise = partyAnalyses
      .filter((p) => p.mcsChange != null && p.mcsChange > 5)
      .sort((a, b) => b.mcsChange! - a.mcsChange!)[0];
    if (biggestRise) {
      findings.push({
        type: "mcs_riser",
        party: biggestRise.abbreviation,
        note: `${biggestRise.abbreviation} steeg het meest in MCS: +${biggestRise.mcsChange} punten (${biggestRise.preElectionMcs} -> ${biggestRise.currentMcs}).`,
      });
    }

    return {
      parliamentId: parliament.id,
      parliamentName: parliament.shortName ?? parliament.name,
      parliamentSlug: parliament.slug,
      electionDate: "2026-03-18",
      totalSeats,
      partyCount: partyAnalyses.length,
      correlation,
      findings,
      parties: partyAnalyses,
    };
  }

  /**
   * Cross-municipality uitslag-analyse overview.
   * Shows correlation and key findings for all 4 municipalities.
   */
  async getUitslagAnalyseOverview() {
    const municipalities = await prisma.parliament.findMany({
      where: { level: "MUNICIPAL", active: true },
      select: { slug: true },
      orderBy: { name: "asc" },
    });

    const results = await Promise.all(
      municipalities.map((m) => this.getUitslagAnalyse(m.slug)),
    );

    // Cross-city findings
    const crossFindings: { type: string; note: string }[] = [];

    const positiveCorr = results.filter((r) => r.correlation?.direction === "positive");
    const negativeCorr = results.filter((r) => r.correlation?.direction === "negative");

    if (positiveCorr.length >= 3) {
      crossFindings.push({
        type: "cross_city_reward",
        note: `In ${positiveCorr.length} van ${results.length} gemeenten was er een positief verband tussen MCS en zetels. Kiezers beloonden betrouwbaarheid.`,
      });
    } else if (negativeCorr.length >= 3) {
      crossFindings.push({
        type: "cross_city_punish",
        note: `In ${negativeCorr.length} van ${results.length} gemeenten wonnen partijen met lagere MCS juist meer zetels.`,
      });
    } else {
      crossFindings.push({
        type: "cross_city_mixed",
        note: `Het verband tussen MCS en verkiezingsuitslag verschilde per gemeente. Geen eenduidig patroon.`,
      });
    }

    return {
      electionDate: "2026-03-18",
      municipalities: results.map((r) => ({
        slug: r.parliamentSlug,
        name: r.parliamentName,
        totalSeats: r.totalSeats,
        correlation: r.correlation,
        topFindings: r.findings.slice(0, 2),
        partyCount: r.partyCount,
      })),
      crossFindings,
    };
  }

  /**
   * Helper: Get national TK party MCS scores for comparison.
   * Returns Map<abbreviation, mcs>.
   */
  private async getNationalPartyScores(abbreviations: string[]): Promise<Map<string, number>> {
    const tkParliament = await prisma.parliament.findUnique({
      where: { slug: "tweede-kamer" },
      select: { id: true },
    });
    if (!tkParliament) return new Map();

    const nationalParties = await prisma.party.findMany({
      where: {
        parliamentId: tkParliament.id,
        abbreviation: { in: abbreviations },
      },
      select: { id: true, abbreviation: true },
    });

    if (nationalParties.length === 0) return new Map();

    const scorecards = await prisma.precomputedScorecard.findMany({
      where: {
        partyId: { in: nationalParties.map((p) => p.id) },
        programType: "VERKIEZINGSPROGRAMMA",
      },
      orderBy: { electionYear: "desc" },
    });

    const result = new Map<string, number>();
    for (const np of nationalParties) {
      const sc = scorecards.find((s) => s.partyId === np.id);
      if (sc?.mcs != null) result.set(np.abbreviation, sc.mcs);
    }
    return result;
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
