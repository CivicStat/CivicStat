import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PartiesService } from "./parties.service";
import { PartiesScorecardService } from "./parties-scorecard.service";
import { CoalitionDynamicsService } from "../coalitions/coalition-dynamics.service";
import { MembersService } from "../members/members.service";

@ApiTags("parties")
@Controller("parties")
export class PartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly scorecardService: PartiesScorecardService,
    private readonly coalitionDynamicsService: CoalitionDynamicsService,
    private readonly membersService: MembersService,
  ) {}

  @ApiOperation({ summary: "List all parties" })
  @Get()
  async list() {
    return this.partiesService.list();
  }

  // ─── Scorecard endpoints ──────────────────────────────────

  /** GET /parties/scorecards?year=2023&periodStart=2023-12-06&periodEnd=2025-10-29 */
  @ApiOperation({ summary: "Get MCS scorecards for all parties", description: "Returns Motion Consistency Score (MCS) for all tracked parties, optionally filtered by election year or custom date range." })
  @ApiQuery({ name: "year", required: false, description: "Election year (e.g. 2023, 2025)" })
  @ApiQuery({ name: "periodStart", required: false, description: "Start date for custom period (ISO 8601)" })
  @ApiQuery({ name: "periodEnd", required: false, description: "End date for custom period (ISO 8601)" })
  @Get("scorecards")
  async scorecards(
    @Query("year") year?: string,
    @Query("periodStart") periodStart?: string,
    @Query("periodEnd") periodEnd?: string,
  ) {
    return this.scorecardService.getAllScorecards({
      electionYear: year ? parseInt(year) : undefined,
      periodStart,
      periodEnd,
    });
  }

  /** GET /parties/scorecards/years — available election years */
  @ApiOperation({ summary: "List available election years for scorecards" })
  @Get("scorecards/years")
  async scorecardYears() {
    return this.scorecardService.getAvailableYears();
  }

  /** GET /parties/scorecards/compare?years=2023,2025 */
  @ApiOperation({ summary: "Compare scorecards across election years" })
  @ApiQuery({ name: "years", required: false, description: "Comma-separated election years (e.g. 2023,2025)" })
  @ApiQuery({ name: "periodStart", required: false })
  @ApiQuery({ name: "periodEnd", required: false })
  @Get("scorecards/compare")
  async compareAll(
    @Query("years") yearsStr?: string,
    @Query("periodStart") periodStart?: string,
    @Query("periodEnd") periodEnd?: string,
  ) {
    const years = yearsStr
      ? yearsStr.split(",").map(y => parseInt(y.trim()))
      : [2023, 2025];
    return this.scorecardService.compareScorecards(years, { periodStart, periodEnd });
  }

  /** GET /parties/:id/scorecard?year=2023&periodStart=...&periodEnd=... */
  @ApiOperation({ summary: "Get detailed MCS scorecard for a party" })
  @ApiParam({ name: "id", description: "Party abbreviation (e.g. VVD, D66, PVV)" })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "periodStart", required: false })
  @ApiQuery({ name: "periodEnd", required: false })
  @Get(":id/scorecard")
  async scorecard(
    @Param("id") id: string,
    @Query("year") year?: string,
    @Query("periodStart") periodStart?: string,
    @Query("periodEnd") periodEnd?: string,
  ) {
    try {
      return await this.scorecardService.getScorecard(id, {
        electionYear: year ? parseInt(year) : undefined,
        periodStart,
        periodEnd,
      });
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Scorecard computation failed for ${id}:`, err);
      throw new InternalServerErrorException("Scorecard computation failed");
    }
  }

  /** GET /parties/:id/koersvastheid?years=2023,2025 */
  @ApiOperation({ summary: "Cross-year consistency (koersvastheid) for a party", description: "Measures how consistently a party votes in line with its own promises across different election cycles." })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "years", required: false, description: "Comma-separated election years" })
  @Get(":id/koersvastheid")
  async koersvastheid(
    @Param("id") id: string,
    @Query("years") yearsStr?: string,
  ) {
    const years = yearsStr
      ? yearsStr.split(",").map(y => parseInt(y.trim()))
      : [2023, 2025];
    try {
      return await this.scorecardService.getKoersvastheid(id, years);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Koersvastheid computation failed for ${id}:`, err);
      throw new InternalServerErrorException("Koersvastheid computation failed");
    }
  }

  /** GET /parties/:id/regeerakkoord?year=2024&periodStart=...&periodEnd=... */
  @ApiOperation({ summary: "Coalition agreement (regeerakkoord) scorecard for a party" })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "periodStart", required: false })
  @ApiQuery({ name: "periodEnd", required: false })
  @Get(":id/regeerakkoord")
  async regeerakkoord(
    @Param("id") id: string,
    @Query("year") year?: string,
    @Query("periodStart") periodStart?: string,
    @Query("periodEnd") periodEnd?: string,
  ) {
    try {
      return await this.scorecardService.getRegeerakkoordScorecard(id, {
        electionYear: year ? parseInt(year) : undefined,
        periodStart,
        periodEnd,
      });
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Regeerakkoord scorecard failed for ${id}:`, err);
      throw new InternalServerErrorException("Regeerakkoord scorecard computation failed");
    }
  }

  /** GET /parties/:id/coalitieverwatering?year=2026 */
  @ApiOperation({ summary: "Coalitieverwatering score for a party", description: "Measures how much a coalition party has diluted its election promises after entering government." })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "year", required: false })
  @Get(":id/coalitieverwatering")
  async coalitieverwatering(
    @Param("id") id: string,
    @Query("year") year?: string,
  ) {
    try {
      return await this.scorecardService.getCoalitieverwatering(id, {
        electionYear: year ? parseInt(year) : undefined,
      });
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Coalitieverwatering computation failed for ${id}:`, err);
      throw new InternalServerErrorException("Coalitieverwatering computation failed");
    }
  }

  // ─── Coalition dynamics ──────────────────────────────────

  /** GET /parties/:id/coalition-alignment?coalition=schoof */
  @ApiOperation({ summary: "Coalition Alignment Index (CAI) for a party" })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "coalition", required: false, description: "Coalition slug (e.g. schoof, jetten)" })
  @Get(":id/coalition-alignment")
  async coalitionAlignment(
    @Param("id") id: string,
    @Query("coalition") coalitionSlug?: string,
  ) {
    try {
      // Get all CAI results for the coalition, then filter to this party
      const slug = coalitionSlug || "schoof";
      const allResults =
        await this.coalitionDynamicsService.computeCAI(slug);

      // Find by party ID or abbreviation
      const party = await this.partiesService.get(id);
      const result = allResults.find(
        (r) => r.abbreviation === party.abbreviation,
      );

      if (!result) {
        return {
          abbreviation: party.abbreviation,
          coalitionSlug: slug,
          cai: null,
          note: "Geen stemdata beschikbaar voor deze coalitieperiode",
        };
      }

      return result;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Coalition alignment failed for ${id}:`, err);
      throw new InternalServerErrorException(
        "Coalition alignment computation failed",
      );
    }
  }

  /** GET /parties/:id/vrije-stemmen?year=2023&coalition=schoof */
  @ApiOperation({ summary: "Vrije Stemmen MCS for a party", description: "MCS computed only on free votes (not coalition-whipped motions)." })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "coalition", required: false })
  @Get(":id/vrije-stemmen")
  async vrijeStemmen(
    @Param("id") id: string,
    @Query("year") year?: string,
    @Query("coalition") coalitionSlug?: string,
  ) {
    try {
      return await this.coalitionDynamicsService.getVrijeStemmenMCS(
        id,
        year ? parseInt(year) : 2023,
        coalitionSlug,
      );
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Vrije Stemmen MCS failed for ${id}:`, err);
      throw new InternalServerErrorException(
        "Vrije Stemmen MCS computation failed",
      );
    }
  }

  // ─── Rebel / deviation detection ─────────────────────────

  /** GET /parties/:id/rebels?minVotes=20 */
  @ApiOperation({ summary: "Rebel MPs for a party", description: "MPs who frequently deviate from their party line." })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @ApiQuery({ name: "minVotes", required: false, description: "Minimum vote count threshold" })
  @Get(":id/rebels")
  async rebels(
    @Param("id") id: string,
    @Query("minVotes") minVotes?: string,
  ) {
    return this.membersService.getPartyRebels(id, {
      minVotes: minVotes ? Number(minVotes) : undefined,
    });
  }

  // ─── Party detail ─────────────────────────────────────────

  @ApiOperation({ summary: "Get party detail" })
  @ApiParam({ name: "id", description: "Party abbreviation" })
  @Get(":id")
  async get(@Param("id") id: string) {
    return this.partiesService.get(id);
  }
}
