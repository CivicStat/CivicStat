import { Controller, Get, Param, Query } from "@nestjs/common";
import { VotesService } from "./votes.service";

@Controller("votes")
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.votesService.list({
      query: q,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.votesService.get(id);
  }
}
