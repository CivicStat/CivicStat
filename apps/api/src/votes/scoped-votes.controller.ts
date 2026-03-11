import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { VotesService } from "./votes.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped votes:
 *   GET /parliament/:slug/votes
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug/votes")
export class ScopedVotesController {
  constructor(
    private readonly votesService: VotesService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "List votes for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "result", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
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
