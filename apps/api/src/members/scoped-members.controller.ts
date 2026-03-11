import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { MembersService } from "./members.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped members:
 *   GET /parliament/:slug/members
 *   GET /parliament/:slug/members/:id
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug/members")
export class ScopedMembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @ApiOperation({ summary: "List MPs for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "party", required: false })
  @ApiQuery({ name: "active", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  @Get()
  async list(
    @Param("slug") slug: string,
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("active") active?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    const parsedLimit = Math.min(Number(limit ?? 50), 100);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    return this.membersService.list({
      query: q,
      party,
      active: active !== "false",
      limit: Number.isNaN(parsedLimit) ? 50 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
      parliamentId,
    });
  }

  @ApiOperation({ summary: "Get MP detail (parliament-scoped)" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiParam({ name: "id", description: "MP ID" })
  @Get(":id")
  async get(@Param("slug") slug: string, @Param("id") id: string) {
    await this.parliamentService.findBySlug(slug);
    return this.membersService.get(id);
  }
}
