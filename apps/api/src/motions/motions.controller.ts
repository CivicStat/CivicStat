import { Controller, Get, Param, Query } from "@nestjs/common";
import { MotionsService } from "./motions.service";

@Controller("motions")
export class MotionsController {
  constructor(private readonly motionsService: MotionsService) {}

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Math.min(Number(limit ?? 20), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.motionsService.list({
      query: q,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.motionsService.get(id);
  }
}
