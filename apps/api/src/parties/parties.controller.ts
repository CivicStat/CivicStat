import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PartiesService } from "./parties.service";
import { PartiesScorecardService } from "./parties-scorecard.service";

@Controller("parties")
export class PartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly scorecardService: PartiesScorecardService,
  ) {}

  @Get()
  async list() {
    return this.partiesService.list();
  }

  // ─── Scorecard endpoints ──────────────────────────────────

  /** GET /parties/scorecards?year=2023&periodStart=2023-12-06&periodEnd=2025-10-29 */
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
  @Get("scorecards/years")
  async scorecardYears() {
    return this.scorecardService.getAvailableYears();
  }

  /** GET /parties/scorecards/compare?years=2023,2025 */
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

  // ─── Party detail ─────────────────────────────────────────

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.partiesService.get(id);
  }
}
