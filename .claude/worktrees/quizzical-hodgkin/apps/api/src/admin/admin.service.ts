import { Injectable } from "@nestjs/common";
import { prisma } from "@ntp/db";

@Injectable()
export class AdminService {
  async getStatus() {
    const latestRun = await prisma.pipelineRun.findFirst({
      orderBy: { startedAt: "desc" },
    }).catch(() => null);

    const latestSuccess = await prisma.pipelineRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    }).catch(() => null);

    const [
      motionCount,
      voteCount,
      voteRecordCount,
      promiseCount,
      matchCount,
      scorecardCount,
      sponsorCount,
      mpCount,
      partyCount,
    ] = await Promise.all([
      prisma.motion.count(),
      prisma.vote.count(),
      prisma.voteRecord.count(),
      prisma.promise.count(),
      prisma.promiseMotionMatch.count(),
      prisma.precomputedScorecard.count(),
      prisma.motionSponsor.count(),
      prisma.mp.count(),
      prisma.party.count(),
    ]);

    const latestMotion = await prisma.motion.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const latestVote = await prisma.vote.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const matchedPromises = await prisma.promiseMotionMatch.groupBy({
      by: ["promiseId"],
    }).then((r: any[]) => r.length).catch(() => 0);

    const matchRate = promiseCount > 0
      ? Math.round((matchedPromises / promiseCount) * 100)
      : 0;

    const recentErrors = await prisma.pipelineRun.count({
      where: {
        startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { in: ["FAILED", "PARTIAL"] },
      },
    }).catch(() => 0);

    return {
      status: this.determineHealthStatus(latestRun, recentErrors),
      lastRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            trigger: latestRun.trigger,
            startedAt: latestRun.startedAt,
            completedAt: latestRun.completedAt,
            durationMs: latestRun.durationMs,
            steps: latestRun.steps,
          }
        : null,
      lastSuccessfulRun: latestSuccess?.startedAt || null,
      data: {
        motions: motionCount,
        votes: voteCount,
        voteRecords: voteRecordCount,
        promises: promiseCount,
        matches: matchCount,
        scorecards: scorecardCount,
        sponsors: sponsorCount,
        mps: mpCount,
        parties: partyCount,
      },
      freshness: {
        latestMotionUpdate: latestMotion?.updatedAt || null,
        latestVoteUpdate: latestVote?.updatedAt || null,
        matchRate: `${matchRate}%`,
        matchedPromises,
        totalPromises: promiseCount,
      },
      errors: {
        last24h: recentErrors,
      },
      version: {
        algorithm: "keyword-v2",
      },
    };
  }

  async getPipelineRuns(limit: number = 20) {
    return prisma.pipelineRun
      .findMany({
        orderBy: { startedAt: "desc" },
        take: limit,
      })
      .catch(() => []);
  }

  private determineHealthStatus(
    latestRun: any,
    recentErrors: number
  ): "healthy" | "degraded" | "unhealthy" | "unknown" {
    if (!latestRun) return "unknown";
    if (latestRun.status === "FAILED") return "unhealthy";
    if (recentErrors >= 3) return "unhealthy";
    if (recentErrors >= 1) return "degraded";
    if (latestRun.status === "COMPLETED") {
      const hoursSinceRun =
        (Date.now() - latestRun.startedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRun > 12) return "degraded";
    }
    return "healthy";
  }
}
