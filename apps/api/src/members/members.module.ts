import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { MemberScorecardService } from "./member-scorecard.service";

@Module({
  controllers: [MembersController],
  providers: [MembersService, MemberScorecardService],
  exports: [MembersService, MemberScorecardService],
})
export class MembersModule {}
