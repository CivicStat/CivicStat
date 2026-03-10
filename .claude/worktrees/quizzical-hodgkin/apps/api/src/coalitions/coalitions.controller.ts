import { Controller, Get, Param, Query } from "@nestjs/common";
import { COALITIONS } from "./coalitions.config";
import { CoalitionDynamicsService } from "./coalition-dynamics.service";

@Controller("coalitions")
export class CoalitionsController {
  constructor(
    private readonly coalitionDynamicsService: CoalitionDynamicsService,
  ) {}

  /**
   * GET /coalitions — list all known coalition configurations.
   */
  @Get()
  listCoalitions() {
    return COALITIONS.map((c) => ({
      name: c.name,
      slug: c.slug,
      parties: c.parties,
      startDate: c.startDate,
      endDate: c.endDate,
      active: c.endDate === null,
    }));
  }

  /**
   * GET /coalitions/:slug/alignment — CAI for all tracked parties
   * during this coalition's active period.
   */
  @Get(":slug/alignment")
  async getAlignment(@Param("slug") slug: string) {
    return this.coalitionDynamicsService.computeCAI(slug);
  }

  /**
   * GET /coalitions/:slug/classification — Vote classification summary.
   * Returns how many votes were coalition-unanimous vs. free votes.
   */
  @Get(":slug/classification")
  async getClassification(@Param("slug") slug: string) {
    const result = await this.coalitionDynamicsService.classifyVotes(slug);
    // Don't return the full Map — just summary stats
    return {
      coalitionName: result.coalitionName,
      coalitionSlug: result.coalitionSlug,
      totalVotes: result.totalVotes,
      coalitionVotes: result.coalitionVotes,
      freeVotes: result.freeVotes,
      noDataVotes: result.noDataVotes,
      coalitionPct: result.totalVotes > 0
        ? Math.round((result.coalitionVotes / result.totalVotes) * 100)
        : 0,
      freePct: result.totalVotes > 0
        ? Math.round((result.freeVotes / result.totalVotes) * 100)
        : 0,
    };
  }
}
