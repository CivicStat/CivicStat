import { Module } from "@nestjs/common";
import { PartiesController } from "./parties.controller";
import { PartiesService } from "./parties.service";
import { PartiesScorecardService } from "./parties-scorecard.service";

@Module({
  controllers: [PartiesController],
  providers: [PartiesService, PartiesScorecardService],
  exports: [PartiesService],
})
export class PartiesModule {}
