import { Module } from "@nestjs/common";
import { CoalitionsController } from "./coalitions.controller";
import { CoalitionDynamicsService } from "./coalition-dynamics.service";
import { PartiesScorecardService } from "../parties/parties-scorecard.service";

@Module({
  controllers: [CoalitionsController],
  providers: [CoalitionDynamicsService, PartiesScorecardService],
  exports: [CoalitionDynamicsService],
})
export class CoalitionsModule {}
