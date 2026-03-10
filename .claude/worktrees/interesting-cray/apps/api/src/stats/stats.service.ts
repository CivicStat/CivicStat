import { Injectable } from "@nestjs/common";
import { prisma } from "@ntp/db";

@Injectable()
export class StatsService {
  async getStats() {
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
      prisma.promise.count(),
      prisma.motion.count(),
      prisma.vote.count(),
      prisma.voteRecord.count(),
      prisma.promiseMotionMatch.count(),
      prisma.promiseMotionMatch.count({
        where: { matchMethod: { startsWith: "keyword" } },
      }),
      prisma.promiseMotionMatch.count({
        where: { matchMethod: "semantic-claude" },
      }),
      prisma.promiseMotionMatch.count({
        where: { matchMethod: "manual" },
      }),
      prisma.party.count({
        where: { seats: { gt: 0 } },
      }),
      prisma.mp.count(),
      prisma.program.count(),
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
