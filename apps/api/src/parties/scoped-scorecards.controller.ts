import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PartiesScorecardService } from "./parties-scorecard.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped scorecard endpoints:
 *   GET /parliament/:slug/scorecards           → all scorecards for a parliament
 *   GET /parliament/:slug/parties/:id/scorecard → scorecard for a specific party in a parliament
 */
@ApiTags("parliament-scoped")
@Controller("parliament/:slug")
export class ScopedScorecardsController {
  constructor(
    private readonly scorecardService: PartiesScorecardService,
    private readonly parliamentService: ParliamentService,
  ) {}

  /** GET /parliament/:slug/scorecards?year=2022 */
  @ApiOperation({ summary: "Get all MCS scorecards for a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiQuery({ name: "year", required: false, description: "Election year" })
  @Get("scorecards")
  async allScorecards(
    @Param("slug") slug: string,
    @Query("year") year?: string,
  ) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.scorecardService.getAllScorecardsScoped({
      parliamentId,
      electionYear: year ? parseInt(year) : undefined,
    });
  }

  /** GET /parliament/:slug/parties/:id/scorecard?year=2022 */
  @ApiOperation({ summary: "Get MCS scorecard for a party in a parliament" })
  @ApiParam({ name: "slug", description: "Parliament slug" })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "year", required: false })
  @Get("parties/:id/scorecard")
  async partyScorecard(
    @Param("slug") slug: string,
    @Param("id") id: string,
    @Query("year") year?: string,
  ) {
    await this.parliamentService.findBySlug(slug);
    try {
      return await this.scorecardService.getScorecardScoped(id, {
        electionYear: year ? parseInt(year) : undefined,
      });
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Scoped scorecard failed for ${id}:`, err);
      throw new InternalServerErrorException("Scorecard computation failed");
    }
  }
}
