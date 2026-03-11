import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { VotesService } from "./votes.service";

@ApiTags("votes")
@Controller("votes")
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @ApiOperation({ summary: "Get consensus vote statistics across all parties" })
  @Get("consensus")
  @Header("Cache-Control", "public, max-age=3600")
  async consensus() {
    return this.votesService.getConsensus();
  }

  @ApiOperation({ summary: "List votes (stemmingen)" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "party", required: false, description: "Party abbreviation" })
  @ApiQuery({ name: "result", required: false, description: "Vote result filter" })
  @ApiQuery({ name: "limit", required: false, description: "Page size (max 100, default 20)" })
  @ApiQuery({ name: "offset", required: false })
  @Get()
  async list(
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("result") result?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.votesService.list({
      query: q,
      party,
      result,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
    });
  }

  @ApiOperation({ summary: "Get vote detail" })
  @ApiParam({ name: "id", description: "Vote ID" })
  @Get(":id")
  async get(@Param("id") id: string) {
    return this.votesService.get(id);
  }
}
