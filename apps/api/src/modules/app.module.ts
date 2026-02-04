import { Module } from "@nestjs/common";
import { HealthModule } from "../health/health.module";
import { MotionsModule } from "../motions/motions.module";
import { VotesModule } from "../votes/votes.module";

@Module({
  imports: [HealthModule, MotionsModule, VotesModule]
})
export class AppModule {}
