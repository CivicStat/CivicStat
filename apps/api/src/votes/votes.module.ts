import { Module } from "@nestjs/common";
import { VotesController } from "./votes.controller";
import { ScopedVotesController } from "./scoped-votes.controller";
import { VotesService } from "./votes.service";
import { ParliamentModule } from "../parliament/parliament.module";

@Module({
  imports: [ParliamentModule],
  controllers: [VotesController, ScopedVotesController],
  providers: [VotesService],
  exports: [VotesService],
})
export class VotesModule {}
