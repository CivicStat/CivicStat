import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";
import { PredictionsService } from "../predictions/predictions.service";

interface MotionListParams {
  query?: string;
  party?: string;
  status?: string;
  result?: string;
  soort?: string; // "Motie" | "Amendement" | "Wetsvoorstel"
  hasVotes?: boolean;
  hasPromiseMatches?: boolean;
  limit: number;
  offset: number;
  parliamentId?: string; // Filter by parliament scope
}

@Injectable()
export class MotionsService {
  constructor(private readonly predictionsService: PredictionsService) {}

  async list({ query, party, status, result, soort, hasVotes, hasPromiseMatches, limit, offset, parliamentId }: MotionListParams) {
    const where: any = {};

    if (parliamentId) {
      where.parliamentId = parliamentId;
    }

    if (soort) {
      where.soort = soort;
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { text: { contains: query, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (result) {
      where.result = result;
    }

    if (hasVotes) {
      where.result = { not: null };
    }

    // Filter by whether the motion has promise matches (= has AI prediction)
    if (hasPromiseMatches === true) {
      where.promiseMatches = { some: {} };
    } else if (hasPromiseMatches === false) {
      where.promiseMatches = { none: {} };
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
              result: true,
              totalFor: true,
              totalAgainst: true,
              totalAbstain: true,
            },
            take: 1,
          },
          _count: {
            select: { promiseMatches: true },
          },
        },
      }),
      prisma.motion.count({ where }),
    ]);

    return {
      items: items.map(m => ({
        ...m,
        vote: m.votes[0] ?? null,
        votes: undefined,
        hasPromiseMatches: m._count.promiseMatches > 0,
        _count: undefined,
      })),
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

    // Compute prediction on-the-fly from promise matches
    const prediction = await this.predictionsService.predictMotion(motion.id);

    return {
      ...motion,
      vote,
      prediction,
    };
  }

  private async findMotion(idOrTkId: string) {
    const motionInclude = {
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
      promiseMatches: {
        include: {
          promise: {
            select: {
              id: true,
              promiseCode: true,
              summary: true,
              theme: true,
              expectedVoteDirection: true,
              program: {
                select: {
                  electionYear: true,
                  party: {
                    select: {
                      id: true,
                      abbreviation: true,
                      colorNeutral: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { confidence: "desc" as const },
      },
    };

    const byId = await prisma.motion.findUnique({
      where: { id: idOrTkId },
      include: motionInclude,
    });

    if (byId) return byId;

    const byTkId = await prisma.motion.findUnique({
      where: { tkId: idOrTkId },
      include: motionInclude,
    });

    if (!byTkId) {
      throw new NotFoundException("Motion not found");
    }

    return byTkId;
  }
}
