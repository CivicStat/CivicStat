import { Module } from "@nestjs/common";
import { StatsController } from "./stats.controller";
import { ScopedStatsController } from "./scoped-stats.controller";
import { StatsService } from "./stats.service";
import { ParliamentModule } from "../parliament/parliament.module";

@Module({
  imports: [ParliamentModule],
  controllers: [StatsController, ScopedStatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
