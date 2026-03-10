import { Module } from "@nestjs/common";
import { HealthModule } from "../health/health.module";
import { MotionsModule } from "../motions/motions.module";
import { VotesModule } from "../votes/votes.module";
import { PartiesModule } from "../parties/parties.module";
import { MembersModule } from "../members/members.module";
import { PromisesModule } from "../promises/promises.module";
import { StatsModule } from "../stats/stats.module";

@Module({
  imports: [
    HealthModule,
    MotionsModule,
    VotesModule,
    PartiesModule,
    MembersModule,
    PromisesModule,
    StatsModule,
  ],
})
export class AppModule {}
