import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface MotionListParams {
  query?: string;
  party?: string;
  status?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class MotionsService {
  async list({ query, party, status, limit, offset }: MotionListParams) {
    const where: any = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { text: { contains: query, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // If filtering by party, join through sponsors
    if (party) {
      where.sponsors = {
        some: {
          mp: {
            party: {
              OR: [
                { abbreviation: { equals: party, mode: "insensitive" } },
                { name: { equals: party, mode: "insensitive" } },
              ],
            },
          },
        },
      };
    }

    const [items, total] = await Promise.all([
      prisma.motion.findMany({
        where,
        orderBy: { dateIntroduced: "desc" },
        skip: offset,
        take: limit,
        include: {
          sponsors: {
            include: {
              mp: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  party: {
                    select: {
                      id: true,
                      name: true,
                      abbreviation: true,
                    },
                  },
                },
              },
            },
          },
          votes: {
            select: {
              id: true,
              tkId: true,
              result: true,
              totalFor: true,
              totalAgainst: true,
              totalAbstain: true,
            },
            take: 1,
          },
        },
      }),
      prisma.motion.count({ where }),
    ]);

    return {
      items: items.map(m => ({ ...m, vote: m.votes[0] ?? null, votes: undefined })),
      total,
      limit,
      offset,
    };
  }

  async get(idOrTkId: string) {
    const motion = await this.findMotion(idOrTkId);

    // Get full vote details if exists
    const firstVote = motion.votes?.[0] ?? null;
    const vote = firstVote
      ? await prisma.vote.findUnique({
          where: { id: firstVote.id },
          include: {
            records: {
              include: {
                mp: {
                  select: {
                    id: true,
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
            },
          },
        })
      : null;

    return {
      ...motion,
      vote,
    };
  }

  private async findMotion(idOrTkId: string) {
    const byId = await prisma.motion.findUnique({
      where: { id: idOrTkId },
      include: {
        sponsors: {
          include: {
            mp: {
              select: {
                id: true,
                tkId: true,
                name: true,
                surname: true,
                party: {
                  select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                    colorNeutral: true,
                  },
                },
              },
            },
          },
        },
        votes: {
          select: {
            id: true,
            tkId: true,
            date: true,
            result: true,
            totalFor: true,
            totalAgainst: true,
            totalAbstain: true,
          },
          take: 1,
        },
      },
    });

    if (byId) return byId;

    const byTkId = await prisma.motion.findUnique({
      where: { tkId: idOrTkId },
      include: {
        sponsors: {
          include: {
            mp: {
              select: {
                id: true,
                tkId: true,
                name: true,
                surname: true,
                party: {
                  select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                    colorNeutral: true,
                  },
                },
              },
            },
          },
        },
        votes: {
          select: {
            id: true,
            tkId: true,
            date: true,
            result: true,
            totalFor: true,
            totalAgainst: true,
            totalAbstain: true,
          },
          take: 1,
        },
      },
    });

    if (!byTkId) {
      throw new NotFoundException("Motion not found");
    }

    return byTkId;
  }
}
