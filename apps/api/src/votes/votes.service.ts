import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface VoteListParams {
  query?: string;
  party?: string;
  result?: string; // "Aangenomen" or "Verworpen"
  limit: number;
  offset: number;
}

@Injectable()
export class VotesService {
  async list({ query, party, result, limit, offset }: VoteListParams) {
    const where: any = {};

    if (query) {
      where.title = { contains: query, mode: "insensitive" };
    }

    if (result) {
      where.result = result;
    }

    const [items, total] = await Promise.all([
      prisma.vote.findMany({
        where,
        orderBy: { date: "desc" },
        skip: offset,
        take: limit,
        include: {
          motion: {
            select: {
              id: true,
              tkId: true,
              title: true,
              tkNumber: true,
            },
          },
          _count: {
            select: { records: true },
          },
        },
      }),
      prisma.vote.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async get(idOrTkId: string) {
    const vote = await this.findVote(idOrTkId);

    // Include full voting records with MP and party info
    const records = await prisma.voteRecord.findMany({
      where: { voteId: vote.id },
      include: {
        mp: {
          select: {
            id: true,
            tkId: true,
            name: true,
            surname: true,
          },
        },
        party: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            colorNeutral: true,
          },
        },
      },
      orderBy: {
        party: {
          abbreviation: "asc",
        },
      },
    });

    // Aggregate by party
    const partyStats = await this.getPartyStats(vote.id);

    return {
      ...vote,
      records,
      partyStats,
    };
  }

  async getPartyStats(voteId: string) {
    const records = await prisma.voteRecord.findMany({
      where: { voteId },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });

    // Group by party
    const partyMap = new Map<string, {
      party: { id: string; name: string; abbreviation: string };
      for: number;
      against: number;
      abstain: number;
      absent: number;
      total: number;
    }>();

    for (const record of records) {
      const key = record.party.id;

      if (!partyMap.has(key)) {
        partyMap.set(key, {
          party: record.party,
          for: 0,
          against: 0,
          abstain: 0,
          absent: 0,
          total: 0,
        });
      }

      const stats = partyMap.get(key)!;
      stats.total++;

      switch (record.voteValue) {
        case "FOR":
          stats.for++;
          break;
        case "AGAINST":
          stats.against++;
          break;
        case "ABSTAIN":
          stats.abstain++;
          break;
        case "ABSENT":
          stats.absent++;
          break;
      }
    }

    return Array.from(partyMap.values()).sort((a, b) =>
      a.party.abbreviation.localeCompare(b.party.abbreviation)
    );
  }

  private async findVote(idOrTkId: string) {
    const byId = await prisma.vote.findUnique({
      where: { id: idOrTkId },
      include: {
        motion: {
          select: {
            id: true,
            tkId: true,
            title: true,
            tkNumber: true,
            text: true,
          },
        },
      },
    });

    if (byId) return byId;

    const byTkId = await prisma.vote.findUnique({
      where: { tkId: idOrTkId },
      include: {
        motion: {
          select: {
            id: true,
            tkId: true,
            title: true,
            tkNumber: true,
            text: true,
          },
        },
      },
    });

    if (!byTkId) {
      throw new NotFoundException("Vote not found");
    }

    return byTkId;
  }
}
