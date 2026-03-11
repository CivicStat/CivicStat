import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PromisesService } from "./promises.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped promises:
 *   GET /parliament/:slug/promises/stats
 *   GET /parliament/:slug/promises
 *   GET /parliament/:slug/promises/:id
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug/promises")
export class ScopedPromisesController {
  constructor(
    private readonly promisesService: PromisesService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "Get promise statistics for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @Get("stats")
  async stats(@Param("slug") slug: string) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.promisesService.stats(parliamentId);
  }

  @ApiOperation({ summary: "List promises for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "party", required: false })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "theme", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  @Get()
  async list(
    @Param("slug") slug: string,
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("year") year?: string,
    @Query("theme") theme?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    const parsedLimit = Math.min(Number(limit ?? 50), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.promisesService.list({
      q,
      party,
      year: year ? Number(year) : undefined,
      theme,
      limit: Number.isNaN(parsedLimit) ? 50 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
      parliamentId,
    });
  }

  @ApiOperation({ summary: "Get promise detail (parliament-scoped)" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiParam({ name: "id", description: "Promise ID" })
  @Get(":id")
  async get(@Param("slug") slug: string, @Param("id") id: string) {
    await this.parliamentService.findBySlug(slug);
    return this.promisesService.get(id);
  }
}
