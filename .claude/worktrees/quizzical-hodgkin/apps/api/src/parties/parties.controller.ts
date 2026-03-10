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
import { CoalitionDynamicsService } from "../coalitions/coalition-dynamics.service";

@Controller("parties")
export class PartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly scorecardService: PartiesScorecardService,
    private readonly coalitionDynamicsService: CoalitionDynamicsService,
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

  /** GET /parties/:id/regeerakkoord?year=2024&periodStart=...&periodEnd=... */
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

  // ─── Party detail ─────────────────────────────────────────

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.partiesService.get(id);
  }
}
