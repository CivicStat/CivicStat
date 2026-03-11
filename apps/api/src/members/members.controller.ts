import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { MembersService } from "./members.service";
import { MemberScorecardService } from "./member-scorecard.service";

@ApiTags("members")
@Controller("members")
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly scorecardService: MemberScorecardService,
  ) {}

  @ApiOperation({ summary: "List members of parliament (Kamerleden)" })
  @ApiQuery({ name: "q", required: false, description: "Name search" })
  @ApiQuery({ name: "party", required: false, description: "Party abbreviation" })
  @ApiQuery({ name: "active", required: false, description: "Filter active MPs only (default: true)" })
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

  @ApiOperation({ summary: "Get MCS scorecards for all members" })
  @ApiQuery({ name: "electionYear", required: false })
  @ApiQuery({ name: "party", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
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

  @ApiOperation({ summary: "Get MP detail" })
  @ApiParam({ name: "id", description: "MP ID" })
  @Get(":id")
  async get(@Param("id") id: string) {
    return this.membersService.get(id);
  }

  @ApiOperation({ summary: "Get voting record for an MP" })
  @ApiParam({ name: "id", description: "MP ID" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
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

  @ApiOperation({ summary: "Get MCS scorecard for an MP" })
  @ApiParam({ name: "id", description: "MP ID" })
  @ApiQuery({ name: "electionYear", required: false })
  @ApiQuery({ name: "periodStart", required: false })
  @ApiQuery({ name: "periodEnd", required: false })
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
