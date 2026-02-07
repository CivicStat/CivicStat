import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface MembersListParams {
  party?: string;
  active?: boolean;
}

@Injectable()
export class MembersService {
  async list({ party, active = true }: MembersListParams) {
    const where: any = {};

    if (active) {
      where.OR = [{ endDate: null }, { endDate: { gte: new Date() } }];
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
