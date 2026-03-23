import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";
import { COALITIONS } from "../coalitions/coalitions.config";

interface MembersListParams {
  query?: string;
  q?: string; // alias for query (backward compat)
  party?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
  parliamentId?: string; // Filter by parliament scope
}

@Injectable()
export class MembersService {
  async list({ q, query, party, active = true, limit, offset, parliamentId }: MembersListParams) {
    const searchTerm = query || q;
    const where: any = {};

    if (parliamentId) {
      where.parliamentId = parliamentId;
    }

    if (active) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      });
    }

    if (searchTerm) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { surname: { contains: searchTerm, mode: "insensitive" } },
          { party: { abbreviation: { contains: searchTerm, mode: "insensitive" } } },
          { party: { name: { contains: searchTerm, mode: "insensitive" } } },
        ],
      });
    }

    if (party) {
      where.party = {
        OR: [
          { abbreviation: { equals: party, mode: "insensitive" } },
          { name: { equals: party, mode: "insensitive" } },
        ],
      };
    }

    const members = await prisma.mp.findMany({
      where,
      orderBy: { surname: "asc" },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            colorNeutral: true,
          },
        },
        _count: {
          select: {
            sponsors: true,
            voteRecords: true,
          },
        },
      },
    });

    return members;
  }

  async get(idOrTkId: string) {
    const member = await this.findMember(idOrTkId);

    // Get sponsored motions (scoped to member's parliament)
    const motions = await prisma.motion.findMany({
      where: {
        parliamentId: member.parliamentId,
        sponsors: {
          some: {
            mpId: member.id,
          },
        },
      },
      orderBy: { dateIntroduced: "desc" },
      take: 20,
      include: {
        sponsors: {
          where: {
            mpId: member.id,
          },
          select: {
            role: true,
          },
        },
        votes: {
          select: {
            result: true,
            totalFor: true,
            totalAgainst: true,
          },
          take: 1,
        },
      },
    });

    // Get voting stats
    const voteStats = await this.getMemberVoteStats(member.id);

    return {
      ...member,
      motions,
      voteStats,
    };
  }

  /**
   * Get MP voting record with party-line comparison and deviation score.
   * For each vote, determines the party majority position and whether the MP deviated.
   */
  async getVotingRecord(idOrTkId: string, params?: { limit?: number; offset?: number }) {
    const member = await this.findMember(idOrTkId);
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    // Get MP's vote records with vote + motion context
    const records = await prisma.voteRecord.findMany({
      where: {
        mpId: member.id,
        voteValue: { in: ["FOR", "AGAINST"] }, // Only countable votes
      },
      orderBy: { vote: { date: "desc" } },
      skip: offset,
      take: limit,
      include: {
        vote: {
          select: {
            id: true,
            date: true,
            result: true,
            motion: {
              select: {
                id: true,
                title: true,
                soort: true,
              },
            },
          },
        },
      },
    });

    if (records.length === 0) {
      return {
        member: { id: member.id, name: member.name, party: member.party },
        deviationScore: null,
        totalVotesAnalyzed: 0,
        deviations: 0,
        votes: [],
      };
    }

    // Batch: get party majority for all these votes in one query
    const voteIds = records.map((r) => r.vote.id);
    const partyRecords = await prisma.voteRecord.findMany({
      where: {
        voteId: { in: voteIds },
        partyIdSnapshot: member.party.id,
        voteValue: { in: ["FOR", "AGAINST"] },
      },
      select: {
        voteId: true,
        voteValue: true,
      },
    });

    // Compute party majority per vote
    const partyMajority = new Map<string, { for: number; against: number }>();
    for (const pr of partyRecords) {
      const counts = partyMajority.get(pr.voteId) ?? { for: 0, against: 0 };
      if (pr.voteValue === "FOR") counts.for++;
      else counts.against++;
      partyMajority.set(pr.voteId, counts);
    }

    let deviations = 0;
    const votes = records.map((r) => {
      const majority = partyMajority.get(r.vote.id);
      const partyLine = majority
        ? majority.for >= majority.against
          ? "FOR"
          : "AGAINST"
        : null;
      const deviated = partyLine !== null && r.voteValue !== partyLine;
      if (deviated) deviations++;

      return {
        voteId: r.vote.id,
        date: r.vote.date,
        result: r.vote.result,
        motion: r.vote.motion,
        mpVote: r.voteValue,
        partyLine,
        deviated,
      };
    });

    return {
      member: { id: member.id, name: member.name, party: member.party },
      deviationScore: votes.length > 0
        ? Math.round((deviations / votes.length) * 1000) / 10
        : null,
      totalVotesAnalyzed: votes.length,
      deviations,
      votes,
    };
  }

  /**
   * Compute deviation scores for all active MPs in a party.
   * Returns MPs sorted by deviation (highest rebels first).
   */
  async getPartyRebels(partyIdOrAbbr: string, params?: { minVotes?: number; parliamentId?: string }) {
    const party = await this.findPartyByIdOrAbbr(partyIdOrAbbr, params?.parliamentId);
    const minVotes = params?.minVotes ?? 20;

    // Get all active MPs in this party
    const mpWhere: any = {
      partyId: party.id,
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
    };
    if (params?.parliamentId) mpWhere.parliamentId = params.parliamentId;

    const mps = await prisma.mp.findMany({
      where: mpWhere,
      select: { id: true, name: true, surname: true, tkId: true },
    });

    if (mps.length === 0) return { party: { id: party.id, name: party.name, abbreviation: party.abbreviation }, rebels: [] };

    const mpIds = mps.map((m) => m.id);

    // Batch: get all vote records for party MPs (FOR/AGAINST only, last year)
    const allRecords = await prisma.voteRecord.findMany({
      where: {
        partyIdSnapshot: party.id,
        voteValue: { in: ["FOR", "AGAINST"] },
        mpId: { in: mpIds },
        vote: {
          date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
      },
      select: {
        mpId: true,
        voteId: true,
        voteValue: true,
      },
    });

    // Group by vote to compute party majority
    const voteGroups = new Map<string, { for: number; against: number }>();
    for (const r of allRecords) {
      const counts = voteGroups.get(r.voteId) ?? { for: 0, against: 0 };
      if (r.voteValue === "FOR") counts.for++;
      else counts.against++;
      voteGroups.set(r.voteId, counts);
    }

    // Party majority per vote
    const partyLine = new Map<string, string>();
    for (const [voteId, counts] of voteGroups) {
      partyLine.set(voteId, counts.for >= counts.against ? "FOR" : "AGAINST");
    }

    // Per-MP deviation
    const mpStats = new Map<string, { total: number; deviations: number }>();
    for (const r of allRecords) {
      const stats = mpStats.get(r.mpId) ?? { total: 0, deviations: 0 };
      stats.total++;
      const majority = partyLine.get(r.voteId);
      if (majority && r.voteValue !== majority) stats.deviations++;
      mpStats.set(r.mpId, stats);
    }

    // Build results, filter by minVotes, sort by deviation desc
    const mpMap = new Map(mps.map((m) => [m.id, m]));
    const rebels = Array.from(mpStats.entries())
      .filter(([, stats]) => stats.total >= minVotes)
      .map(([mpId, stats]) => {
        const mp = mpMap.get(mpId)!;
        return {
          mpId,
          tkId: mp.tkId,
          name: mp.name,
          surname: mp.surname,
          totalVotes: stats.total,
          deviations: stats.deviations,
          deviationScore: Math.round((stats.deviations / stats.total) * 1000) / 10,
        };
      })
      .sort((a, b) => b.deviationScore - a.deviationScore);

    return {
      party: { id: party.id, name: party.name, abbreviation: party.abbreviation },
      minVotesThreshold: minVotes,
      rebels,
    };
  }

  private async findPartyByIdOrAbbr(idOrAbbr: string, parliamentId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrAbbr);
    if (isUuid) {
      const p = await prisma.party.findUnique({ where: { id: idOrAbbr } });
      if (p) return p;
    }
    const byTkId = await prisma.party.findUnique({ where: { tkId: idOrAbbr } });
    if (byTkId) return byTkId;
    const abbrWhere: any = { abbreviation: { equals: idOrAbbr, mode: "insensitive" } };
    if (parliamentId) abbrWhere.parliamentId = parliamentId;
    const byAbbr = await prisma.party.findFirst({ where: abbrWhere });
    if (!byAbbr) throw new NotFoundException("Party not found");
    return byAbbr;
  }

  async getMemberVoteStats(mpId: string) {
    const records = await prisma.voteRecord.findMany({
      where: {
        mpId,
        vote: {
          date: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
          },
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
    let totalAbsent = 0;

    for (const record of records) {
      switch (record.voteValue) {
        case "FOR":
          totalFor++;
          break;
        case "AGAINST":
          totalAgainst++;
          break;
        case "ABSTAIN":
          totalAbstain++;
          break;
        case "ABSENT":
          totalAbsent++;
          break;
      }
    }

    return {
      totalVotes: records.length,
      for: totalFor,
      against: totalAgainst,
      abstain: totalAbstain,
      absent: totalAbsent,
      participationRate: records.length > 0 
        ? ((records.length - totalAbsent) / records.length) * 100 
        : 0,
    };
  }

  /**
   * Cross-party rebel leaderboard: rank all MPs by deviation rate.
   * Optionally scoped to a parliament. Flags coalition rebels.
   */
  async getRebels(params?: { parliamentId?: string; minVotes?: number; limit?: number }) {
    const minVotes = params?.minVotes ?? 20;
    const limit = params?.limit ?? 50;

    // Get all active MPs (optionally parliament-scoped)
    const mpWhere: any = {
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
    };
    if (params?.parliamentId) {
      mpWhere.parliamentId = params.parliamentId;
    }

    const mps = await prisma.mp.findMany({
      where: mpWhere,
      select: { id: true, name: true, surname: true, tkId: true, partyId: true },
    });

    if (mps.length === 0) return { rebels: [], total: 0 };

    const mpIds = mps.map((m) => m.id);
    const partyIds = [...new Set(mps.map((m) => m.partyId).filter(Boolean))];

    // Fetch parties for labeling
    const parties = await prisma.party.findMany({
      where: { id: { in: partyIds as string[] } },
      select: { id: true, name: true, abbreviation: true },
    });
    const partyMap = new Map(parties.map((p) => [p.id, p]));

    // Active coalition abbreviations
    const now = new Date();
    const activeCoalition = COALITIONS.find((c) => {
      const start = new Date(c.startDate);
      const end = c.endDate ? new Date(c.endDate) : new Date("2099-12-31");
      return now >= start && now <= end;
    });
    const coalitionAbbrs = new Set(activeCoalition?.parties ?? []);

    // All vote records for these MPs (last year, FOR/AGAINST only)
    const allRecords = await prisma.voteRecord.findMany({
      where: {
        mpId: { in: mpIds },
        voteValue: { in: ["FOR", "AGAINST"] },
        vote: { date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      },
      select: { mpId: true, voteId: true, voteValue: true, partyIdSnapshot: true },
    });

    // Group by (party, vote) to compute party majority
    const partyVoteCounts = new Map<string, { for: number; against: number }>();
    for (const r of allRecords) {
      const key = `${r.partyIdSnapshot}:${r.voteId}`;
      const c = partyVoteCounts.get(key) ?? { for: 0, against: 0 };
      if (r.voteValue === "FOR") c.for++;
      else c.against++;
      partyVoteCounts.set(key, c);
    }

    // Per-MP stats
    const mpStats = new Map<string, { total: number; deviations: number }>();
    for (const r of allRecords) {
      const key = `${r.partyIdSnapshot}:${r.voteId}`;
      const counts = partyVoteCounts.get(key);
      if (!counts) continue;
      const partyLine = counts.for >= counts.against ? "FOR" : "AGAINST";

      const stats = mpStats.get(r.mpId) ?? { total: 0, deviations: 0 };
      stats.total++;
      if (r.voteValue !== partyLine) stats.deviations++;
      mpStats.set(r.mpId, stats);
    }

    const mpMap = new Map(mps.map((m) => [m.id, m]));
    const rebels = Array.from(mpStats.entries())
      .filter(([, s]) => s.total >= minVotes)
      .map(([mpId, stats]) => {
        const mp = mpMap.get(mpId)!;
        const party = mp.partyId ? partyMap.get(mp.partyId) : null;
        const isCoalition = party ? coalitionAbbrs.has(party.abbreviation) : false;
        return {
          mpId,
          tkId: mp.tkId,
          name: mp.name,
          surname: mp.surname,
          party: party ? { id: party.id, name: party.name, abbreviation: party.abbreviation } : null,
          totalVotes: stats.total,
          deviations: stats.deviations,
          deviationScore: Math.round((stats.deviations / stats.total) * 1000) / 10,
          isCoalitionRebel: isCoalition && stats.deviations > 0,
        };
      })
      .sort((a, b) => b.deviationScore - a.deviationScore)
      .slice(0, limit);

    return {
      coalition: activeCoalition ? { name: activeCoalition.name, parties: activeCoalition.parties } : null,
      total: rebels.length,
      minVotesThreshold: minVotes,
      rebels,
    };
  }

  /**
   * Individual MP deviation detail: every vote where they diverged from party line.
   */
  async getMemberDeviations(idOrTkId: string, params?: { limit?: number; offset?: number }) {
    const member = await this.findMember(idOrTkId);
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    // Get all MP vote records (FOR/AGAINST only)
    const records = await prisma.voteRecord.findMany({
      where: {
        mpId: member.id,
        voteValue: { in: ["FOR", "AGAINST"] },
      },
      orderBy: { vote: { date: "desc" } },
      include: {
        vote: {
          select: {
            id: true,
            date: true,
            result: true,
            motion: {
              select: { id: true, title: true, soort: true },
            },
          },
        },
      },
    });

    if (records.length === 0) {
      return {
        member: { id: member.id, name: member.name, surname: (member as any).surname, party: member.party },
        deviationScore: null,
        totalVotes: 0,
        totalDeviations: 0,
        deviations: [],
      };
    }

    // Get party majority for all these votes
    const voteIds = records.map((r) => r.vote.id);
    const partyRecords = await prisma.voteRecord.findMany({
      where: {
        voteId: { in: voteIds },
        partyIdSnapshot: member.party.id,
        voteValue: { in: ["FOR", "AGAINST"] },
      },
      select: { voteId: true, voteValue: true },
    });

    const partyMajority = new Map<string, { for: number; against: number }>();
    for (const pr of partyRecords) {
      const c = partyMajority.get(pr.voteId) ?? { for: 0, against: 0 };
      if (pr.voteValue === "FOR") c.for++;
      else c.against++;
      partyMajority.set(pr.voteId, c);
    }

    // Filter to deviations only
    const deviationVotes: any[] = [];
    let totalDeviations = 0;
    for (const r of records) {
      const majority = partyMajority.get(r.vote.id);
      if (!majority) continue;
      const partyLine = majority.for >= majority.against ? "FOR" : "AGAINST";
      if (r.voteValue !== partyLine) {
        totalDeviations++;
        deviationVotes.push({
          voteId: r.vote.id,
          date: r.vote.date,
          result: r.vote.result,
          motion: r.vote.motion,
          mpVote: r.voteValue,
          partyLine,
          partyFor: majority.for,
          partyAgainst: majority.against,
        });
      }
    }

    return {
      member: { id: member.id, name: member.name, surname: (member as any).surname, party: member.party },
      deviationScore: records.length > 0
        ? Math.round((totalDeviations / records.length) * 1000) / 10
        : null,
      totalVotes: records.length,
      totalDeviations,
      deviations: deviationVotes.slice(offset, offset + limit),
    };
  }

  /**
   * Party cohesion score: inverse of average deviation rate across all active MPs.
   */
  async getPartyCohesion(partyIdOrAbbr: string, params?: { parliamentId?: string }) {
    const rebelsData = await this.getPartyRebels(partyIdOrAbbr, {
      minVotes: 10,
      parliamentId: params?.parliamentId,
    });

    if (rebelsData.rebels.length === 0) {
      return {
        party: rebelsData.party,
        cohesionScore: null,
        avgDeviationRate: null,
        mpCount: 0,
        rebels: [],
      };
    }

    const avgDeviation =
      rebelsData.rebels.reduce((sum, r) => sum + r.deviationScore, 0) / rebelsData.rebels.length;

    return {
      party: rebelsData.party,
      cohesionScore: Math.round((100 - avgDeviation) * 10) / 10,
      avgDeviationRate: Math.round(avgDeviation * 10) / 10,
      mpCount: rebelsData.rebels.length,
      rebels: rebelsData.rebels.slice(0, 10), // Top 10 rebels
    };
  }

  private async findMember(idOrTkId: string) {
    const byId = await prisma.mp.findUnique({
      where: { id: idOrTkId },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            colorNeutral: true,
          },
        },
      },
    });

    if (byId) return byId;

    const byTkId = await prisma.mp.findUnique({
      where: { tkId: idOrTkId },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            colorNeutral: true,
          },
        },
      },
    });

    if (!byTkId) {
      throw new NotFoundException("Member not found");
    }

    return byTkId;
  }
}
