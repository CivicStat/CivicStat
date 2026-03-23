import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, PartyStatus } from "@ntp/db";
import { getCoalitionForDate, COALITIONS } from "../coalitions/coalitions.config";

@Injectable()
export class PartiesService {
  async list(params?: { parliamentId?: string }) {
    const where: any = {};

    if (params?.parliamentId) {
      // For parliament-scoped queries, just filter by parliamentId
      where.parliamentId = params.parliamentId;
    } else {
      // Default: show active parties (backward compat for TK)
      where.OR = [
        { endDate: null },
        { endDate: { gte: new Date() } },
        { programs: { some: { electionYear: 2023 } } },
      ];
    }

    const parties = await prisma.party.findMany({
      where,
      orderBy: { abbreviation: "asc" },
      include: {
        _count: {
          select: {
            mps: true,
          },
        },
      },
    });

    return parties.map((p) => ({
      ...p,
      seats: p.seats ?? 0,
    }));
  }

  async get(idOrAbbr: string) {
    const party = await this.findParty(idOrAbbr);

    // Get current MPs
    const mps = await prisma.mp.findMany({
      where: {
        partyId: party.id,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      orderBy: { surname: "asc" },
      select: {
        id: true,
        tkId: true,
        name: true,
        surname: true,
        startDate: true,
        endDate: true,
      },
    });

    // Get voting stats (pass abbreviation for coalition-aware labelling)
    const voteStats = await this.getPartyVoteStats(party.id, party.abbreviation);

    return {
      ...party,
      seats: party.seats ?? 0,
      mps,
      voteStats,
    };
  }

  async getPartyVoteStats(partyId: string, abbreviation?: string) {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const records = await prisma.voteRecord.findMany({
      where: {
        partyIdSnapshot: partyId,
        vote: {
          date: { gte: oneYearAgo },
        },
      },
      include: {
        vote: {
          select: {
            result: true,
          },
        },
      },
    });

    let totalFor = 0;
    let totalAgainst = 0;
    let totalAbstain = 0;
    let votesWon = 0;

    for (const record of records) {
      switch (record.voteValue) {
        case "FOR":
          totalFor++;
          if (record.vote.result === "Aangenomen") votesWon++;
          break;
        case "AGAINST":
          totalAgainst++;
          if (record.vote.result === "Verworpen") votesWon++;
          break;
        case "ABSTAIN":
          totalAbstain++;
          break;
      }
    }

    // Determine coalition status for context-aware labelling
    const coalition = getCoalitionForDate(new Date());
    const isCoalition = abbreviation && coalition
      ? coalition.parties.includes(abbreviation)
      : null;
    const winLabel = isCoalition === null
      ? "Winnende kant"
      : isCoalition
        ? "Coalitie-alignment"
        : "Motiesucces";

    // Compute motion effectiveness: % of own submitted motions that passed
    const partyMpIds = await prisma.mp.findMany({
      where: { partyId },
      select: { id: true },
    });
    const mpIdSet = partyMpIds.map((m) => m.id);

    let motionEffectiveness: number | null = null;
    if (mpIdSet.length > 0) {
      const sponsoredMotions = await prisma.motion.findMany({
        where: {
          sponsors: { some: { mpId: { in: mpIdSet }, role: "indiener" } },
          dateIntroduced: { gte: oneYearAgo },
        },
        include: {
          votes: { select: { result: true }, take: 1 },
        },
      });
      const withResult = sponsoredMotions.filter((m) => m.votes.length > 0);
      const passed = withResult.filter((m) => m.votes[0].result === "Aangenomen");
      motionEffectiveness = withResult.length > 0
        ? Math.round((passed.length / withResult.length) * 100)
        : null;
    }

    return {
      totalVotes: records.length,
      for: totalFor,
      against: totalAgainst,
      abstain: totalAbstain,
      votesWon,
      votesLost: records.length - votesWon - totalAbstain,
      winLabel,
      motionEffectiveness,
      motionsSponsoredCount: mpIdSet.length > 0
        ? await prisma.motionSponsor.count({
            where: {
              mpId: { in: mpIdSet },
              role: "indiener",
              motion: { dateIntroduced: { gte: oneYearAgo } },
            },
          })
        : 0,
    };
  }

  /**
   * Get party status monitor for a specific parliament.
   * Returns all parties with their status, risk flags, and successor info.
   */
  async getPartyStatusMonitor(parliamentId?: string) {
    const where: any = {};
    if (parliamentId) {
      where.parliamentId = parliamentId;
    }

    const parties = await prisma.party.findMany({
      where,
      orderBy: { abbreviation: "asc" },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        seats: true,
        partyStatus: true,
        statusChangedAt: true,
        statusNote: true,
        atRisk: true,
        startDate: true,
        endDate: true,
        successorParty: {
          select: { id: true, name: true, abbreviation: true },
        },
        predecessors: {
          select: { id: true, name: true, abbreviation: true },
        },
        _count: {
          select: { mps: true },
        },
      },
    });

    return parties.map((p) => ({
      id: p.id,
      name: p.name,
      abbreviation: p.abbreviation,
      seats: p.seats ?? 0,
      activeMps: p._count.mps,
      partyStatus: p.partyStatus,
      statusChangedAt: p.statusChangedAt,
      statusNote: p.statusNote,
      atRisk: p.atRisk,
      successorParty: p.successorParty,
      predecessors: p.predecessors,
    }));
  }

  /**
   * Scan all parties in a parliament and flag those with 0 seats as at-risk.
   * Returns count of newly flagged parties.
   */
  async refreshAtRiskFlags(parliamentId?: string): Promise<{ flagged: string[]; unflagged: string[] }> {
    const where: any = {};
    if (parliamentId) {
      where.parliamentId = parliamentId;
    }

    const parties = await prisma.party.findMany({
      where,
      select: { id: true, abbreviation: true, seats: true, atRisk: true, partyStatus: true, endDate: true },
    });

    const flagged: string[] = [];
    const unflagged: string[] = [];
    const now = new Date();

    for (const party of parties) {
      const isStillActive = !party.endDate || party.endDate > now;
      const shouldBeAtRisk = party.seats === 0 && isStillActive && party.partyStatus === "ACTIEF";
      if (shouldBeAtRisk && !party.atRisk) {
        await prisma.party.update({
          where: { id: party.id },
          data: { atRisk: true },
        });
        flagged.push(party.abbreviation);
      } else if (!shouldBeAtRisk && party.atRisk) {
        await prisma.party.update({
          where: { id: party.id },
          data: { atRisk: false },
        });
        unflagged.push(party.abbreviation);
      }
    }

    return { flagged, unflagged };
  }

  /**
   * Update party status (admin action).
   */
  async updatePartyStatus(
    idOrAbbr: string,
    status: PartyStatus,
    opts?: { note?: string; successorPartyId?: string },
  ) {
    const party = await this.findParty(idOrAbbr);
    return prisma.party.update({
      where: { id: party.id },
      data: {
        partyStatus: status,
        statusChangedAt: new Date(),
        statusNote: opts?.note,
        successorPartyId: opts?.successorPartyId,
        atRisk: status !== "ACTIEF",
      },
    });
  }

  /**
   * Partijautopsie — full post-mortem for a party in severe decline.
   * Aggregates: MCS scorecard, top broken promises, theme breakdown,
   * MP departure timeline, and coalition membership history.
   *
   * Accepts a pre-computed scorecard (from PartiesScorecardService)
   * to avoid duplicating the scoring algorithm.
   */
  async getAutopsy(
    idOrAbbr: string,
    opts: { electionYear?: number; scorecard?: any } = {},
  ) {
    const party = await this.findParty(idOrAbbr);
    const electionYear = opts.electionYear ?? 2023;

    // 1. Belofte-balans: use provided scorecard or build minimal summary
    let belofteBalans: any = null;
    const scorecard = opts.scorecard;
    if (scorecard) {
      // Extract top 5 broken promises (inconsistent, most evidence)
      const brokenPromises = (scorecard.promises ?? [])
        .filter((p: any) => p.status === "inconsistent")
        .sort((a: any, b: any) => b.totalMotionsWithVotes - a.totalMotionsWithVotes)
        .slice(0, 5);

      // Top 5 mixed promises (lowest ratio = closest to breaking)
      const mixedPromises = (scorecard.promises ?? [])
        .filter((p: any) => p.status === "mixed")
        .sort((a: any, b: any) => {
          const ratioA = a.weightedAligned + a.weightedOpposed > 0
            ? a.weightedAligned / (a.weightedAligned + a.weightedOpposed)
            : 1;
          const ratioB = b.weightedAligned + b.weightedOpposed > 0
            ? b.weightedAligned / (b.weightedAligned + b.weightedOpposed)
            : 1;
          return ratioA - ratioB;
        })
        .slice(0, 5);

      belofteBalans = {
        electionYear: scorecard.electionYear,
        totalPromises: scorecard.totalPromises,
        scoredPromises: scorecard.scoredPromises,
        insufficientData: scorecard.insufficientDataPromises,
        consistentCount: scorecard.consistentCount,
        inconsistentCount: scorecard.inconsistentCount,
        mixedCount: scorecard.mixedCount,
        mcs: scorecard.mandateConsistencyScore,
        brokenPromises,
        mixedPromises,
        byTheme: scorecard.byTheme,
      };
    }

    // 2. Oorzakenanalyse: MP departure timeline
    const departedMps = await prisma.mp.findMany({
      where: {
        partyId: party.id,
        endDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        surname: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { endDate: "desc" },
    });

    const activeMps = await prisma.mp.count({
      where: {
        partyId: party.id,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
    });

    // 3. Coalitiegeschiedenis: which coalitions was this party in?
    const coalitionHistory = COALITIONS
      .filter((c) => c.parties.includes(party.abbreviation))
      .map((c) => ({
        name: c.name,
        slug: c.slug,
        parties: c.parties,
        startDate: c.startDate,
        endDate: c.endDate,
      }));

    // 4. Voting stats
    const voteStats = await this.getPartyVoteStats(party.id, party.abbreviation);

    return {
      party: {
        id: party.id,
        name: party.name,
        abbreviation: party.abbreviation,
        seats: party.seats ?? 0,
        partyStatus: (party as any).partyStatus ?? "ACTIEF",
        statusNote: (party as any).statusNote ?? null,
        atRisk: (party as any).atRisk ?? false,
        startDate: party.startDate,
        endDate: party.endDate,
        activeMps,
        departedMps: departedMps.length,
      },
      belofteBalans,
      oorzakenanalyse: {
        mpDepartures: departedMps.map((mp) => ({
          name: `${mp.name} ${mp.surname}`,
          startDate: mp.startDate,
          endDate: mp.endDate,
        })),
        totalDeparted: departedMps.length,
        currentActive: activeMps,
      },
      coalitiegeschiedenis: coalitionHistory,
      stemgedrag: voteStats,
    };
  }

  private async findParty(idOrAbbr: string) {
    // UUID format check — only query by id if it looks like a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrAbbr);

    if (isUuid) {
      const byId = await prisma.party.findUnique({
        where: { id: idOrAbbr },
      });
      if (byId) return byId;
    }

    const byTkId = await prisma.party.findUnique({
      where: { tkId: idOrAbbr },
    });
    if (byTkId) return byTkId;

    // Prefer national (Tweede Kamer) party over municipal duplicates
    const tkParliament = await prisma.parliament.findUnique({
      where: { slug: "tweede-kamer" },
      select: { id: true },
    });
    if (tkParliament) {
      const nationalParty = await prisma.party.findFirst({
        where: {
          abbreviation: { equals: idOrAbbr, mode: "insensitive" },
          parliamentId: tkParliament.id,
        },
      });
      if (nationalParty) return nationalParty;
    }

    const byAbbr = await prisma.party.findFirst({
      where: {
        abbreviation: {
          equals: idOrAbbr,
          mode: "insensitive",
        },
      },
    });

    if (!byAbbr) {
      throw new NotFoundException("Party not found");
    }

    return byAbbr;
  }
}
