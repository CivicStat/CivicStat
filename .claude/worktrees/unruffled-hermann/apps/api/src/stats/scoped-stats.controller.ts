import { Controller, Get, Param } from "@nestjs/common";
import { StatsService } from "./stats.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped stats:
 *   GET /parliament/:slug/stats
 */
@Controller("parliament/:slug")
export class ScopedStatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @Get("stats")
  async getStats(@Param("slug") slug: string) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.statsService.getStats({ parliamentId });
  }
}
