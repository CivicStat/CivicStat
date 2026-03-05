import { Module } from "@nestjs/common";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";
import { ParliamentModule } from "../parliament/parliament.module";
import { PartiesModule } from "../parties/parties.module";

@Module({
  imports: [ParliamentModule, PartiesModule],
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class CampaignModule {}
