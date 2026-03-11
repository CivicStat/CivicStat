import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { COALITIONS } from "./coalitions.config";
import { CoalitionDynamicsService } from "./coalition-dynamics.service";

@ApiTags("coalitions")
@Controller("coalitions")
export class CoalitionsController {
  constructor(
    private readonly coalitionDynamicsService: CoalitionDynamicsService,
  ) {}

  /**
   * GET /coalitions — list all known coalition configurations.
   */
  @ApiOperation({ summary: "List all coalition configurations", description: "Returns all tracked coalitions with their member parties and active periods." })
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
   * GET /coalitions/compare — Compare coalition dynamics across all coalitions.
   * Returns CAI, classification, and coalitieverwatering for each coalition.
   */
  @ApiOperation({ summary: "Compare coalition dynamics across all coalitions", description: "Returns CAI, vote classification, and coalitieverwatering for each tracked coalition." })
  @Get("compare")
  async compareCoalitions() {
    const results = await Promise.all(
      COALITIONS.map(async (c) => {
        const [alignment, classification] = await Promise.all([
          this.coalitionDynamicsService.computeCAI(c.slug),
          this.coalitionDynamicsService.classifyVotes(c.slug),
        ]);

        // CAI stats for coalition members only
        const memberAlignment = alignment.filter((a) => a.isCoalitionMember);
        const avgMemberCAI =
          memberAlignment.length > 0
            ? Math.round(
                memberAlignment.reduce((sum, a) => sum + a.cai, 0) /
                  memberAlignment.length,
              )
            : 0;

        // Coalitieverwatering: % of free votes where coalition parties split
        const coalitionPct =
          classification.totalVotes > 0
            ? Math.round(
                (classification.coalitionVotes / classification.totalVotes) *
                  100,
              )
            : 0;
        const freePct =
          classification.totalVotes > 0
            ? Math.round(
                (classification.freeVotes / classification.totalVotes) * 100,
              )
            : 0;

        return {
          coalition: {
            name: c.name,
            slug: c.slug,
            parties: c.parties,
            startDate: c.startDate,
            endDate: c.endDate,
            active: c.endDate === null,
          },
          classification: {
            totalVotes: classification.totalVotes,
            coalitionVotes: classification.coalitionVotes,
            freeVotes: classification.freeVotes,
            noDataVotes: classification.noDataVotes,
            coalitionPct,
            freePct,
          },
          alignment: {
            avgMemberCAI,
            parties: alignment.map((a) => ({
              abbreviation: a.abbreviation,
              cai: a.cai,
              totalVotesAnalyzed: a.totalVotesAnalyzed,
              isCoalitionMember: a.isCoalitionMember,
            })),
          },
          coalitieverwatering: freePct,
        };
      }),
    );

    return results;
  }

  /**
   * GET /coalitions/:slug/alignment — CAI for all tracked parties
   * during this coalition's active period.
   */
  @ApiOperation({ summary: "Coalition Alignment Index for all parties", description: "Returns CAI scores showing how aligned each party is with coalition voting behavior." })
  @ApiParam({ name: "slug", description: "Coalition slug (e.g. schoof, jetten)" })
  @Get(":slug/alignment")
  async getAlignment(@Param("slug") slug: string) {
    return this.coalitionDynamicsService.computeCAI(slug);
  }

  /**
   * GET /coalitions/:slug/classification — Vote classification summary.
   * Returns how many votes were coalition-unanimous vs. free votes.
   */
  @ApiOperation({ summary: "Vote classification for a coalition", description: "Returns how many votes were coalition-unanimous (coalition votes) vs. free votes where parties split." })
  @ApiParam({ name: "slug", description: "Coalition slug" })
  @Get(":slug/classification")
  async getClassification(@Param("slug") slug: string) {
    const result = await this.coalitionDynamicsService.classifyVotes(slug);
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
