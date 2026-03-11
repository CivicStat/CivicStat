import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PromisesService } from "./promises.service";

@ApiTags("promises")
@Controller("promises")
export class PromisesController {
  constructor(private readonly promisesService: PromisesService) {}

  @ApiOperation({ summary: "Get promise statistics" })
  @Get("stats")
  async stats() {
    return this.promisesService.stats();
  }

  @ApiOperation({ summary: "List election promises" })
  @ApiQuery({ name: "q", required: false, description: "Full-text search" })
  @ApiQuery({ name: "party", required: false, description: "Party abbreviation" })
  @ApiQuery({ name: "year", required: false, description: "Election year" })
  @ApiQuery({ name: "theme", required: false, description: "Promise theme (e.g. WONEN, ZORG, KLIMAAT)" })
  @ApiQuery({ name: "limit", required: false, description: "Page size (max 100, default 50)" })
  @ApiQuery({ name: "offset", required: false })
  @Get()
  async list(
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("year") year?: string,
    @Query("theme") theme?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = Math.min(Number(limit ?? 50), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.promisesService.list({
      q,
      party,
      year: year ? Number(year) : undefined,
      theme,
      limit: Number.isNaN(parsedLimit) ? 50 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
    });
  }

  @ApiOperation({ summary: "Get promise detail with motion matches" })
  @ApiParam({ name: "id", description: "Promise ID" })
  @Get(":id")
  async get(@Param("id") id: string) {
    return this.promisesService.get(id);
  }
}
