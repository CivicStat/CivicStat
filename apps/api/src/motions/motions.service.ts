import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface MotionListParams {
  query?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class MotionsService {
  async list({ query, limit, offset }: MotionListParams) {
    const where = query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { text: { contains: query, mode: "insensitive" } }
          ]
        }
      : undefined;

    const [items, total] = await Promise.all([
      prisma.motion.findMany({
        where,
        orderBy: { dateIntroduced: "desc" },
        skip: offset,
        take: limit
      }),
      prisma.motion.count({ where })
    ]);

    return {
      items,
      total,
      limit,
      offset
    };
  }

  async get(idOrTkId: string) {
    const byId = await prisma.motion.findUnique({ where: { id: idOrTkId } });
    if (byId) {
      return byId;
    }

    const byTkId = await prisma.motion.findUnique({ where: { tkId: idOrTkId } });
    if (!byTkId) {
      throw new NotFoundException("Motion not found");
    }

    return byTkId;
  }
}
