import { Controller, Get, Param, Query } from "@nestjs/common";
import { CampaignService } from "./campaign.service";

@Controller("parliament/:slug")
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get("election-overview")
  async getElectionOverview(@Param("slug") slug: string) {
    return this.campaignService.getElectionOverview(slug);
  }

  @Get("campaign")
  async getCampaignLanding(@Param("slug") slug: string) {
    return this.campaignService.getCampaignLanding(slug);
  }

  /** GET /parliament/:slug/parties/compare?partyIds=VVD,D66,PvdA&year=2026 */
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
