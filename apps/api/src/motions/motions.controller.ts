import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { MotionsService } from "./motions.service";
import { PredictionsService } from "../predictions/predictions.service";
import { ParliamentService } from "../parliament/parliament.service";

@ApiTags("motions")
@Controller("motions")
export class MotionsController {
  constructor(
    private readonly motionsService: MotionsService,
    private readonly predictionsService: PredictionsService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "List parliamentary motions (Tweede Kamer)" })
  @ApiQuery({ name: "q", required: false, description: "Full-text search query" })
  @ApiQuery({ name: "party", required: false, description: "Filter by party abbreviation" })
  @ApiQuery({ name: "status", required: false, description: "Motion status filter" })
  @ApiQuery({ name: "result", required: false, description: "Vote result filter (aangenomen/verworpen)" })
  @ApiQuery({ name: "soort", required: false, description: "Motion type (Motie/Amendement/Wetsvoorstel)" })
  @ApiQuery({ name: "hasVotes", required: false, description: "Filter to motions with vote records" })
  @ApiQuery({ name: "hasPromiseMatches", required: false, description: "Filter by promise match presence" })
  @ApiQuery({ name: "limit", required: false, description: "Page size (max 100, default 20)" })
  @ApiQuery({ name: "offset", required: false, description: "Page offset" })
  @Get()
  async list(
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("status") status?: string,
    @Query("result") result?: string,
    @Query("soort") soort?: string,
    @Query("hasVotes") hasVotes?: string,
    @Query("hasPromiseMatches") hasPromiseMatches?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    // Default to Tweede Kamer to prevent cross-parliament data leaking
    const parliamentId = await this.parliamentService.resolveParliamentId("tweede-kamer");

    return this.motionsService.list({
      query: q,
      party,
      status,
      result,
      soort,
      hasVotes: hasVotes === "true",
      hasPromiseMatches: hasPromiseMatches === "true" ? true : hasPromiseMatches === "false" ? false : undefined,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
      parliamentId,
    });
  }

  @ApiOperation({ summary: "Get motion detail" })
  @ApiParam({ name: "id", description: "Motion ID" })
  @Get(":id")
  async get(@Param("id") id: string) {
    return this.motionsService.get(id);
  }

  @ApiOperation({ summary: "Predict vote outcome for a motion", description: "Uses promise-motion matches to predict how each party would vote." })
  @ApiParam({ name: "id", description: "Motion ID" })
  @Get(":id/prediction")
  async prediction(@Param("id") id: string) {
    return this.predictionsService.predictMotion(id);
  }
}
