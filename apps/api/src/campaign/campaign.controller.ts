import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CampaignService } from "./campaign.service";

@ApiTags("campaign")
@Controller("parliament/:slug")
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @ApiOperation({ summary: "Get election overview for a municipal parliament", description: "Returns scorecards, promises, and voter-facing summary for a municipal election." })
  @ApiParam({ name: "slug", description: "Parliament slug (e.g. amsterdam, den-haag)" })
  @Get("election-overview")
  async getElectionOverview(@Param("slug") slug: string) {
    return this.campaignService.getElectionOverview(slug);
  }

  @ApiOperation({ summary: "Get campaign landing data for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @Get("campaign")
  async getCampaignLanding(@Param("slug") slug: string) {
    return this.campaignService.getCampaignLanding(slug);
  }

  /** GET /parliament/:slug/parties/compare?partyIds=VVD,D66,PvdA&year=2026 */
  @ApiOperation({ summary: "Compare parties side by side within a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiQuery({ name: "partyIds", required: true, description: "Comma-separated party abbreviations" })
  @ApiQuery({ name: "year", required: false, description: "Election year" })
  @Get("parties/compare")
  async compareParties(
    @Param("slug") slug: string,
    @Query("partyIds") partyIds: string,
    @Query("year") year?: string,
  ) {
    const ids = (partyIds || "").split(",").map((s) => s.trim()).filter(Boolean);
    return this.campaignService.compareParties(
      slug,
      ids,
      year ? parseInt(year) : undefined,
    );
  }
}
