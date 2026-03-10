import { Controller, Get, Param, Query } from "@nestjs/common";
import { PromisesService } from "./promises.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped promises:
 *   GET /parliament/:slug/promises/stats
 *   GET /parliament/:slug/promises
 *   GET /parliament/:slug/promises/:id
 */
@Controller("parliament/:slug/promises")
export class ScopedPromisesController {
  constructor(
    private readonly promisesService: PromisesService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @Get("stats")
  async stats(@Param("slug") slug: string) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.promisesService.stats(parliamentId);
  }

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

  @Get(":id")
  async get(@Param("slug") slug: string, @Param("id") id: string) {
    await this.parliamentService.findBySlug(slug);
    return this.promisesService.get(id);
  }
}
