import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PartiesService } from "./parties.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped parties:
 *   GET /parliament/:slug/parties
 *   GET /parliament/:slug/parties/:id
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug/parties")
export class ScopedPartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "List parties for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @Get()
  async list(@Param("slug") slug: string) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.partiesService.list({ parliamentId });
  }

  @ApiOperation({ summary: "Get party detail (parliament-scoped)" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @Get(":id")
  async get(@Param("slug") slug: string, @Param("id") id: string) {
    await this.parliamentService.findBySlug(slug);
    return this.partiesService.get(id);
  }
}
