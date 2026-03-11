import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StatsService } from "./stats.service";

@ApiTags("stats")
@Controller("stats")
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @ApiOperation({ summary: "Get platform-level statistics", description: "Returns counts of parties, motions, promises, matches, and votes across all parliaments." })
  @Get()
  async getStats() {
    return this.statsService.getStats();
  }
}
