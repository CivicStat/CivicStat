import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface ListOptions {
  party?: string;
  year?: number;
  theme?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PromisesService {
  async list(options: ListOptions = {}) {
    const { party, year, theme, limit = 50, offset = 0 } = options;

    const where: any = {};

    if (party) {
      where.program = {
        party: {
          abbreviation: { equals: party, mode: "insensitive" },
        },
      };
    }

    if (year) {
      where.program = {
        ...where.program,
        electionYear: year,
      };
    }

    if (theme) {
      where.theme = theme.toUpperCase();
    }

    const [items, total] = await Promise.all([
      prisma.promise.findMany({
        where,
        orderBy: [{ theme: "asc" }, { promiseCode: "asc" }],
        skip: offset,
        take: limit,
        include: {
          program: {
            select: {
              id: true,
              electionYear: true,
              title: true,
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
          motionMatches: {
            include: {
              motion: {
                select: {
                  id: true,
                  tkId: true,
                  tkNumber: true,
                  title: true,
                  text: true,
                  dateIntroduced: true,
                  status: true,
                  votes: {
                    select: {
                      id: true,
                      result: true,
                      totalFor: true,
                      totalAgainst: true,
                      totalAbstain: true,
                    },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { confidence: "desc" },
          },
        },
      }),
      prisma.promise.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async get(id: string) {
    const promise = await prisma.promise.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            id: true,
            electionYear: true,
            title: true,
            sourceUrl: true,
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
        passage: {
          select: {
            id: true,
            chapter: true,
            heading: true,
            passageText: true,
          },
        },
        motionMatches: {
          include: {
            motion: {
              select: {
                id: true,
                tkId: true,
                tkNumber: true,
                title: true,
                text: true,
                dateIntroduced: true,
                status: true,
                votes: {
                  select: {
                    id: true,
                    result: true,
                    totalFor: true,
                    totalAgainst: true,
                    totalAbstain: true,
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: { confidence: "desc" },
        },
      },
    });

    if (!promise) {
      throw new NotFoundException("Promise not found");
    }

    return promise;
  }

  async stats() {
    const [totalPromises, totalMatches, byParty, byTheme] = await Promise.all([
      prisma.promise.count(),
      prisma.promiseMotionMatch.count(),
      prisma.$queryRaw`
        SELECT p2.abbreviation, p2.name, COUNT(p.id)::int as count
        FROM promises p
        JOIN programs pr ON p.program_id = pr.id
        JOIN parties p2 ON pr.party_id = p2.id
        GROUP BY p2.abbreviation, p2.name
        ORDER BY count DESC
      ` as Promise<{ abbreviation: string; name: string; count: number }[]>,
      prisma.$queryRaw`
        SELECT theme, COUNT(*)::int as count
        FROM promises
        GROUP BY theme
        ORDER BY count DESC
      ` as Promise<{ theme: string; count: number }[]>,
    ]);

    return {
      totalPromises,
      totalMatches,
      byParty,
      byTheme,
    };
  }
}
