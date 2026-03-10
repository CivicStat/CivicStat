import { Controller, Get, Param, Query } from "@nestjs/common";
import { MembersService } from "./members.service";
import { MemberScorecardService } from "./member-scorecard.service";

@Controller("members")
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly scorecardService: MemberScorecardService,
  ) {}

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("party") party?: string,
    @Query("active") active?: string
  ) {
    return this.membersService.list({
      q,
      party,
      active: active !== "false", // Default true
    });
  }

  @Get("scorecards")
  async allScorecards(
    @Query("electionYear") electionYear?: string,
    @Query("party") party?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.scorecardService.getAllScorecards({
      electionYear: electionYear ? Number(electionYear) : undefined,
      party,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.membersService.get(id);
  }

  @Get(":id/voting-record")
  async votingRecord(
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.membersService.getVotingRecord(id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id/scorecard")
  async scorecard(
    @Param("id") id: string,
    @Query("electionYear") electionYear?: string,
    @Query("periodStart") periodStart?: string,
    @Query("periodEnd") periodEnd?: string,
  ) {
    return this.scorecardService.getScorecard(id, {
      electionYear: electionYear ? Number(electionYear) : undefined,
      periodStart,
      periodEnd,
    });
  }
}
