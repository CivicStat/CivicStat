import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface VoteListParams {
  query?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class VotesService {
  async list({ query, limit, offset }: VoteListParams) {
    const where = query
      ? {
          title: { contains: query, mode: "insensitive" }
        }
      : undefined;

    const [items, total] = await Promise.all([
      prisma.vote.findMany({
        where,
        orderBy: { date: "desc" },
        skip: offset,
        take: limit
      }),
      prisma.vote.count({ where })
    ]);

    return {
      items,
      total,
      limit,
      offset
    };
  }

  async get(idOrTkId: string) {
    const byId = await prisma.vote.findUnique({ where: { id: idOrTkId } });
    if (byId) {
      return byId;
    }

    const byTkId = await prisma.vote.findUnique({ where: { tkId: idOrTkId } });
    if (!byTkId) {
      throw new NotFoundException("Vote not found");
    }

    return byTkId;
  }
}
