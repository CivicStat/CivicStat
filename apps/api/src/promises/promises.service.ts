import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── Scoring constants (same as party scorecard) ──────────
const MATCH_TYPE_WEIGHTS: Record<string, number> = {
  EXPLICIT_MATCH: 1.0,
  IMPLICIT_MATCH: 0.5,
  CONTRADICTS: 1.0,
};

interface ListOptions {
  q?: string;
  party?: string;
  year?: number;
  theme?: string;
  limit?: number;
  offset?: number;
  parliamentId?: string;
}

@Injectable()
export class PromisesService {
  async list(options: ListOptions = {}) {
    const { q, party, year, theme, limit = 50, offset = 0, parliamentId } = options;

    const where: any = {};

    if (q) {
      where.OR = [
        { summary: { contains: q, mode: "insensitive" } },
        { text: { contains: q, mode: "insensitive" } },
        { promiseCode: { contains: q, mode: "insensitive" } },
      ];
    }

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

    if (parliamentId) {
      where.program = {
        ...where.program,
        parliamentId,
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
    // Check if id looks like a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const detailInclude = {
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
                take: 1,
                include: {
                  // Include rawData for party-level vote extraction
                  records: {
                    select: {
                      id: true,
                      voteValue: true,
                      party: {
                        select: {
                          id: true,
                          abbreviation: true,
                        },
                      },
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

    let promise = isUuid
      ? await prisma.promise.findUnique({
          where: { id },
          include: detailInclude,
        })
      : null;

    // Fall back to promiseCode lookup
    if (!promise) {
      promise = await prisma.promise.findFirst({
        where: { promiseCode: { equals: id, mode: "insensitive" } },
        include: detailInclude,
      });
    }

    if (!promise) {
      throw new NotFoundException("Promise not found");
    }

    // ─── Enrich response with party vote direction + consistency ───
    const partyAbbr = promise.program.party.abbreviation;
    const partyName = promise.program.party.name;
    const partyId = promise.program.party.id;
    const partyNames = [partyAbbr, partyName].filter(Boolean);
    const expectedDir = promise.expectedVoteDirection; // "VOOR" or "TEGEN"

    let alignedCount = 0;
    let opposedCount = 0;
    let totalScored = 0;

    const enrichedMatches = promise.motionMatches.map((match: any) => {
      const vote = match.motion.votes?.[0];
      if (!vote) {
        return {
          ...match,
          motion: {
            ...match.motion,
            votes: match.motion.votes.map((v: any) => ({
              id: v.id,
              result: v.result,
              totalFor: v.totalFor,
              totalAgainst: v.totalAgainst,
              totalAbstain: v.totalAbstain,
            })),
          },
          partyVoteDirection: null,
          isConsistent: null,
        };
      }

      // Determine how the party voted on this motion
      let partyVoteDirection: string | null = null;

      // Try party-specific records first (Hoofdelijk)
      const partyRecords = (vote.records || []).filter(
        (r: any) => r.party?.id === partyId
      );

      if (partyRecords.length > 0) {
        const forVotes = partyRecords.filter((r: any) => r.voteValue === "FOR").length;
        const againstVotes = partyRecords.filter((r: any) => r.voteValue === "AGAINST").length;
        if (forVotes > againstVotes) partyVoteDirection = "VOOR";
        else if (againstVotes > forVotes) partyVoteDirection = "TEGEN";
      }

      // Fall back to rawData.Stemming (Met handopsteken)
      if (!partyVoteDirection) {
        const rawStemmingen = (vote as any).rawData?.Stemming || [];
        const partyVote = rawStemmingen.find(
          (s: any) => partyNames.some((n: string) => s.ActorNaam === n)
        );
        if (partyVote) {
          partyVoteDirection = partyVote.Soort?.toLowerCase() === "voor" ? "VOOR" : "TEGEN";
        }
      }

      // Compute consistency
      let isConsistent: boolean | null = null;
      if (partyVoteDirection && expectedDir) {
        const effectiveExpected = match.matchType === "CONTRADICTS"
          ? (expectedDir === "VOOR" ? "TEGEN" : "VOOR")
          : expectedDir;
        isConsistent = partyVoteDirection === effectiveExpected;

        if (match.confidence >= 0.3) {
          totalScored++;
          if (isConsistent) alignedCount++;
          else opposedCount++;
        }
      }

      // Strip individual records from response to keep it clean
      return {
        ...match,
        motion: {
          ...match.motion,
          votes: match.motion.votes.map((v: any) => ({
            id: v.id,
            result: v.result,
            totalFor: v.totalFor,
            totalAgainst: v.totalAgainst,
            totalAbstain: v.totalAbstain,
          })),
        },
        partyVoteDirection,
        isConsistent,
      };
    });

    // Compute overall promise status
    let promiseStatus: string;
    if (totalScored === 0) {
      promiseStatus = "UNSCORED";
    } else {
      const ratio = alignedCount / totalScored;
      if (ratio >= 0.70) promiseStatus = "CONSISTENT";
      else if (ratio <= 0.30) promiseStatus = "BROKEN";
      else promiseStatus = "MIXED";
    }

    return {
      ...promise,
      motionMatches: enrichedMatches,
      promiseStatus,
      scoringSummary: {
        totalMatches: promise.motionMatches.length,
        scoredMatches: totalScored,
        alignedCount,
        opposedCount,
      },
    };
  }

  async stats(parliamentId?: string) {
    const parlWhere = parliamentId
      ? { program: { parliamentId } }
      : {};
    const parlMatchWhere = parliamentId
      ? { promise: { program: { parliamentId } } }
      : {};

    const byPartyQuery = parliamentId
      ? prisma.$queryRawUnsafe(
          `SELECT p2.abbreviation, p2.name, COUNT(p.id)::int as count
           FROM promises p
           JOIN programs pr ON p.program_id = pr.id
           JOIN parties p2 ON pr.party_id = p2.id
           WHERE pr.parliament_id = $1::uuid
           GROUP BY p2.abbreviation, p2.name
           ORDER BY count DESC`,
          parliamentId
        )
      : prisma.$queryRaw`
          SELECT p2.abbreviation, p2.name, COUNT(p.id)::int as count
          FROM promises p
          JOIN programs pr ON p.program_id = pr.id
          JOIN parties p2 ON pr.party_id = p2.id
          GROUP BY p2.abbreviation, p2.name
          ORDER BY count DESC
        `;

    const byThemeQuery = parliamentId
      ? prisma.$queryRawUnsafe(
          `SELECT p.theme, COUNT(*)::int as count
           FROM promises p
           JOIN programs pr ON p.program_id = pr.id
           WHERE pr.parliament_id = $1::uuid
           GROUP BY p.theme
           ORDER BY count DESC`,
          parliamentId
        )
      : prisma.$queryRaw`
          SELECT theme, COUNT(*)::int as count
          FROM promises
          GROUP BY theme
          ORDER BY count DESC
        `;

    const [totalPromises, totalMatches, byParty, byTheme] = await Promise.all([
      prisma.promise.count({ where: parlWhere }),
      prisma.promiseMotionMatch.count({ where: parlMatchWhere }),
      byPartyQuery as Promise<{ abbreviation: string; name: string; count: number }[]>,
      byThemeQuery as Promise<{ theme: string; count: number }[]>,
    ]);

    return {
      totalPromises,
      totalMatches,
      byParty,
      byTheme,
    };
  }
}
