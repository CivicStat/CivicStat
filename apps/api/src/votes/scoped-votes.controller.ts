import { Controller, Get, Param, Query } from "@nestjs/common";
import { VotesService } from "./votes.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped votes:
 *   GET /parliament/:slug/votes
 */
@Controller("parliament/:slug/votes")
export class ScopedVotesController {
  constructor(
    private readonly votesService: VotesService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @Get()
  async list(
    @Param("slug") slug: string,
    @Query("q") q?: string,
    @Query("result") result?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.votesService.list({
      query: q,
      result,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
      parliamentId,
    });
  }
}
