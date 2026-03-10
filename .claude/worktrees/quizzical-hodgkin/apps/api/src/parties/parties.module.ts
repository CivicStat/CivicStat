import { Module } from "@nestjs/common";
import { PartiesController } from "./parties.controller";
import { ScopedPartiesController } from "./scoped-parties.controller";
import { ScopedScorecardsController } from "./scoped-scorecards.controller";
import { PartiesService } from "./parties.service";
import { PartiesScorecardService } from "./parties-scorecard.service";
import { ParliamentModule } from "../parliament/parliament.module";
import { CoalitionsModule } from "../coalitions/coalitions.module";

@Module({
  imports: [ParliamentModule, CoalitionsModule],
  controllers: [PartiesController, ScopedPartiesController, ScopedScorecardsController],
  providers: [PartiesService, PartiesScorecardService],
  exports: [PartiesService],
})
export class PartiesModule {}
