import { Injectable } from "@nestjs/common";
import { prisma } from "@ntp/db";

@Injectable()
export class StatsService {
  async getStats(params?: { parliamentId?: string }) {
    const pFilter = params?.parliamentId ? { parliamentId: params.parliamentId } : {};

    const [
      promises,
      motions,
      votes,
      voteRecords,
      matches,
      keywordMatches,
      semanticMatches,
      manualMatches,
      parties,
      members,
      programs,
    ] = await Promise.all([
      prisma.promise.count({ where: { program: pFilter } }),
      prisma.motion.count({ where: pFilter }),
      prisma.vote.count({ where: pFilter }),
      prisma.voteRecord.count({
        where: params?.parliamentId ? { vote: pFilter } : {},
      }),
      prisma.promiseMotionMatch.count({
        where: params?.parliamentId ? { motion: pFilter } : {},
      }),
      prisma.promiseMotionMatch.count({
        where: {
          matchMethod: { startsWith: "keyword" },
          ...(params?.parliamentId ? { motion: pFilter } : {}),
        },
      }),
      prisma.promiseMotionMatch.count({
        where: {
          matchMethod: "semantic-claude",
          ...(params?.parliamentId ? { motion: pFilter } : {}),
        },
      }),
      prisma.promiseMotionMatch.count({
        where: {
          matchMethod: "manual",
          ...(params?.parliamentId ? { motion: pFilter } : {}),
        },
      }),
      prisma.party.count({
        where: params?.parliamentId ? pFilter : { seats: { gt: 0 } },
      }),
      prisma.mp.count({ where: pFilter }),
      prisma.program.count({ where: pFilter }),
    ]);

    return {
      promises,
      motions,
      votes,
      voteRecords,
      matches,
      matchesByMethod: {
        keyword: keywordMatches,
        semantic: semanticMatches,
        manual: manualMatches,
      },
      parties,
      members,
      programs,
      lastUpdated: new Date().toISOString(),
    };
  }
}
