import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { ScopedMembersController } from "./scoped-members.controller";
import { MembersService } from "./members.service";
import { MemberScorecardService } from "./member-scorecard.service";
import { ParliamentModule } from "../parliament/parliament.module";

@Module({
  imports: [ParliamentModule],
  controllers: [MembersController, ScopedMembersController],
  providers: [MembersService, MemberScorecardService],
  exports: [MembersService, MemberScorecardService],
})
export class MembersModule {}
