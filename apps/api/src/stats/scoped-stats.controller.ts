import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { StatsService } from "./stats.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped stats:
 *   GET /parliament/:slug/stats
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug")
export class ScopedStatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "Get statistics for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @Get("stats")
  async getStats(@Param("slug") slug: string) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.statsService.getStats({ parliamentId });
  }
}
