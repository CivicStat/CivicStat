import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

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

    // Get sponsored motions
    const motions = await prisma.motion.findMany({
      where: {
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
  async getPartyRebels(partyIdOrAbbr: string, params?: { minVotes?: number }) {
    const party = await this.findPartyByIdOrAbbr(partyIdOrAbbr);
    const minVotes = params?.minVotes ?? 20;

    // Get all active MPs in this party
    const mps = await prisma.mp.findMany({
      where: {
        partyId: party.id,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
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

  private async findPartyByIdOrAbbr(idOrAbbr: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrAbbr);
    if (isUuid) {
      const p = await prisma.party.findUnique({ where: { id: idOrAbbr } });
      if (p) return p;
    }
    const byTkId = await prisma.party.findUnique({ where: { tkId: idOrAbbr } });
    if (byTkId) return byTkId;
    const byAbbr = await prisma.party.findFirst({
      where: { abbreviation: { equals: idOrAbbr, mode: "insensitive" } },
    });
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
