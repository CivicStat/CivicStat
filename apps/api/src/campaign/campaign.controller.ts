import { Controller, Get, Param } from "@nestjs/common";
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
}
