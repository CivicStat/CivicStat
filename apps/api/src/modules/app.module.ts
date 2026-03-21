import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { HealthModule } from "../health/health.module";
import { MotionsModule } from "../motions/motions.module";
import { VotesModule } from "../votes/votes.module";
import { PartiesModule } from "../parties/parties.module";
import { MembersModule } from "../members/members.module";
import { PromisesModule } from "../promises/promises.module";
import { AdminModule } from "../admin/admin.module";
import { StatsModule } from "../stats/stats.module";
import { LangfuseModule } from "../langfuse/langfuse.module";
import { InsightsModule } from "../insights/insights.module";
import { ParliamentModule } from "../parliament/parliament.module";
import { CoalitionsModule } from "../coalitions/coalitions.module";
import { CampaignModule } from "../campaign/campaign.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { OpenDataModule } from "../open-data/open-data.module";
import { SearchModule } from "../search/search.module";
import { V2Module } from "../v2/v2.module";
import { FormatieModule } from "../formatie/formatie.module";
import { CompareModule } from "../compare/compare.module";
import { UpdatesModule } from "../updates/updates.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    HealthModule,
    MotionsModule,
    VotesModule,
    PartiesModule,
    MembersModule,
    PromisesModule,
    AdminModule,
    StatsModule,
    LangfuseModule,
    InsightsModule,
    ParliamentModule,
    CoalitionsModule,
    CampaignModule,
    FeedbackModule,
    OpenDataModule,
    SearchModule,
    V2Module,
    FormatieModule,
    CompareModule,
    UpdatesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
