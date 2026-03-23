import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { MotionsService } from "./motions.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped motions:
 *   GET /parliament/:slug/motions
 *   GET /parliament/:slug/motions/:id
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug/motions")
export class ScopedMotionsController {
  constructor(
    private readonly motionsService: MotionsService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "List motions for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug (e.g. amsterdam, den-haag)" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "party", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "result", required: false })
  @ApiQuery({ name: "hasVotes", required: false })
  @ApiQuery({ name: "hasPromiseMatches", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  @Get()
  async list(
    @Param("slug") slug: string,
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("status") status?: string,
    @Query("result") result?: string,
    @Query("hasVotes") hasVotes?: string,
    @Query("hasPromiseMatches") hasPromiseMatches?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.motionsService.list({
      query: q,
      party,
      status,
      result,
      hasVotes: hasVotes === "true",
      hasPromiseMatches:
        hasPromiseMatches === "true"
          ? true
          : hasPromiseMatches === "false"
            ? false
            : undefined,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
      parliamentId,
    });
  }

  @ApiOperation({ summary: "Get motion detail (parliament-scoped)" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiParam({ name: "id", description: "Motion ID" })
  @Get(":id")
  async get(@Param("slug") slug: string, @Param("id") id: string) {
    const parliament = await this.parliamentService.findBySlug(slug);
    const motion = await this.motionsService.get(id);
    if (motion.parliamentId && motion.parliamentId !== parliament.id) {
      throw new NotFoundException("Motion not found");
    }
    return motion;
  }
}
