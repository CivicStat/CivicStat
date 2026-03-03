import { Controller, Get, Param, Query } from "@nestjs/common";
import { MotionsService } from "./motions.service";
import { PredictionsService } from "../predictions/predictions.service";

@Controller("motions")
export class MotionsController {
  constructor(
    private readonly motionsService: MotionsService,
    private readonly predictionsService: PredictionsService,
  ) {}

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
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.motionsService.get(id);
  }

  @Get(":id/prediction")
  async prediction(@Param("id") id: string) {
    return this.predictionsService.predictMotion(id);
  }
}
