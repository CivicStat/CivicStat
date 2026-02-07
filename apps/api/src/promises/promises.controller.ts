import { Controller, Get, Param, Query } from "@nestjs/common";
import { PromisesService } from "./promises.service";

@Controller("promises")
export class PromisesController {
  constructor(private readonly promisesService: PromisesService) {}

  @Get("stats")
  async stats() {
    return this.promisesService.stats();
  }

  @Get()
  async list(
    @Query("party") party?: string,
    @Query("year") year?: string,
    @Query("theme") theme?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Math.min(Number(limit ?? 50), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.promisesService.list({
      party,
      year: year ? Number(year) : undefined,
      theme,
      limit: Number.isNaN(parsedLimit) ? 50 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.promisesService.get(id);
  }
}
