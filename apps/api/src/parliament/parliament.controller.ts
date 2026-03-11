import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ParliamentService } from "./parliament.service";

/**
 * Parliament CRUD endpoints:
 *   GET /parliaments              → list all parliaments
 *   GET /parliaments/:slug        → parliament detail
 */
@ApiTags("parliaments")
@Controller("parliaments")
export class ParliamentController {
  constructor(private readonly parliamentService: ParliamentService) {}

  @ApiOperation({ summary: "List all parliaments", description: "Returns national (Tweede Kamer) and municipal parliaments (Amsterdam, Den Haag, Rotterdam, Utrecht)." })
  @Get()
  async list() {
    return this.parliamentService.list();
  }

  @ApiOperation({ summary: "Get parliament detail" })
  @ApiParam({ name: "slug", description: "Parliament slug (e.g. tweede-kamer, amsterdam, den-haag)" })
  @Get(":slug")
  async get(@Param("slug") slug: string) {
    return this.parliamentService.get(slug);
  }
}
