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

  async getConsensus() {
    const ABBR_MAP: Record<string, string> = {
      "GroenLinks-PvdA": "GL-PvdA",
      "ChristenUnie": "CU",
      "Nieuw Sociaal Contract": "NSC",
      "Partij voor de Vrijheid (PVV)": "PVV",
      "Partij voor de Vrijheid": "PVV",
    };

    const TRACKED_PARTIES = [
      "PVV", "GL-PvdA", "VVD", "NSC", "BBB", "D66", "CDA", "SP",
      "PvdD", "CU", "SGP", "DENK", "Volt", "JA21", "FVD",
    ];

    const trackedSet = new Set(TRACKED_PARTIES);

    // count[a][b] = { agree, total }
    const count: Record<string, Record<string, { agree: number; total: number }>> = {};
    let totalVotes = 0;

    // Process in batches to avoid OOM on small Fly machines
    const BATCH_SIZE = 500;
    let cursor: string | undefined;

    while (true) {
      const batch = await prisma.vote.findMany({
        select: { id: true, rawData: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;
      totalVotes += batch.length;

      for (const vote of batch) {
        const raw = vote.rawData as any;
        const stemmingen: { ActorNaam: string; Soort: string }[] = raw?.Stemming ?? [];

        const partyVote = new Map<string, string>();
        for (const s of stemmingen) {
          const name = ABBR_MAP[s.ActorNaam] ?? s.ActorNaam;
          if (trackedSet.has(name)) {
            partyVote.set(name, s.Soort);
          }
        }

        const parties = Array.from(partyVote.keys());
        for (let i = 0; i < parties.length; i++) {
          for (let j = i + 1; j < parties.length; j++) {
            const a = parties[i] < parties[j] ? parties[i] : parties[j];
            const b = parties[i] < parties[j] ? parties[j] : parties[i];

            if (!count[a]) count[a] = {};
            if (!count[a][b]) count[a][b] = { agree: 0, total: 0 };

            count[a][b].total++;
            const va = partyVote.get(parties[i])!;
            const vb = partyVote.get(parties[j])!;
            if (va === vb) count[a][b].agree++;
          }
        }
      }

      // Let GC reclaim the batch
      if (batch.length < BATCH_SIZE) break;
    }

    // Build matrix (percentage) + collect pairs
    const matrix: Record<string, Record<string, number>> = {};
    const allPairs: { a: string; b: string; pct: number; agree: number; total: number }[] = [];

    for (const a of TRACKED_PARTIES) {
      matrix[a] = {};
      for (const b of TRACKED_PARTIES) {
        if (a === b) { matrix[a][b] = 100; continue; }
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        const c = count[lo]?.[hi];
        if (!c || c.total < 10) { matrix[a][b] = -1; continue; }
        const pct = Math.round((c.agree / c.total) * 100);
        matrix[a][b] = pct;

        if (a < b) {
          allPairs.push({ a, b, pct, agree: c.agree, total: c.total });
        }
      }
    }

    allPairs.sort((x, y) => y.pct - x.pct);

    return {
      parties: TRACKED_PARTIES,
      matrix,
      topAgreement: allPairs.slice(0, 10),
      topDisagreement: allPairs.slice(-10).reverse(),
      totalVotes,
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
