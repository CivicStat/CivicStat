import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { InsightsService } from "./insights.service";
import { PeilingenMcsService } from "./peilingen-mcs.service";
import { EuCalendarService } from "./eu-calendar.service";

@ApiTags("insights")
@Controller("insights")
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly peilingenMcsService: PeilingenMcsService,
    private readonly euCalendarService: EuCalendarService,
  ) {}

  /** GET /insights — all insight types in one response */
  @ApiOperation({ summary: "Get all automated insights", description: "Returns all insight types in one response for the /nl/inzichten page." })
  @Get()
  @Header("Cache-Control", "public, max-age=3600")
  async all() {
    const [base, peilingenDivergentie, euCalendar] = await Promise.all([
      this.insightsService.getAllInsights(),
      this.peilingenMcsService.getDivergenceInsight().catch(() => []),
      this.euCalendarService.getEuCalendar().catch(() => null),
    ]);
    return { ...base, peilingenDivergentie, euCalendar };
  }

  /** GET /insights/bedgenoten — unlikely bedfellows */
  @ApiOperation({ summary: "Onverwachte bedgenoten — parties that vote together unexpectedly" })
  @Get("bedgenoten")
  @Header("Cache-Control", "public, max-age=3600")
  async bedgenoten() {
    return this.insightsService.getOnverwachteBedgenoten();
  }

  /** GET /insights/scheuren — coalition cracks */
  @ApiOperation({ summary: "Coalitie scheuren — motions where coalition parties split" })
  @Get("scheuren")
  @Header("Cache-Control", "public, max-age=3600")
  async scheuren() {
    return this.insightsService.getCoalitieScheuren();
  }

  /** GET /insights/beweging — biggest MCS movers */
  @ApiOperation({ summary: "Stijgers en dalers — parties with biggest MCS changes between elections" })
  @Get("beweging")
  @Header("Cache-Control", "public, max-age=3600")
  async beweging() {
    return this.insightsService.getStijgersDalers();
  }

  /** GET /insights/consensus — silent consensus motions */
  @ApiOperation({ summary: "Stille consensus — motions passed near-unanimously" })
  @Get("consensus")
  @Header("Cache-Control", "public, max-age=3600")
  async consensus() {
    return this.insightsService.getStilleConsensus();
  }

  /** GET /insights/beloftehouders — best & worst promise-keepers */
  @ApiOperation({ summary: "Beloftehouders — parties ranked by MCS (promise compliance)" })
  @Get("beloftehouders")
  @Header("Cache-Control", "public, max-age=3600")
  async beloftehouders() {
    return this.insightsService.getBeloftehouders();
  }

  /** GET /insights/themakloof — worst themes for current coalition */
  @ApiOperation({ summary: "Thema-kloof — coalition's weakest policy themes" })
  @Get("themakloof")
  @Header("Cache-Control", "public, max-age=3600")
  async themakloof() {
    return this.insightsService.getThemaKloof();
  }

  /** GET /insights/rebellen — top rebel MPs across all parties */
  @ApiOperation({ summary: "Rebellen — MPs who most frequently vote against their own party" })
  @Get("rebellen")
  @Header("Cache-Control", "public, max-age=3600")
  async rebellen() {
    return this.insightsService.getTopRebellen();
  }

  /** GET /insights/verwatering — coalition promise dilution */
  @ApiOperation({ summary: "Coalitieverwatering — how many promises survived coalition negotiations" })
  @Get("verwatering")
  @Header("Cache-Control", "public, max-age=3600")
  async verwatering() {
    return this.insightsService.getCoalitieVerwatering();
  }

  /** GET /insights/paradox — parties voting against their own stated positions */
  @ApiOperation({ summary: "Thema-paradox — themes where parties vote opposite to their promises" })
  @Get("paradox")
  @Header("Cache-Control", "public, max-age=3600")
  async paradox() {
    return this.insightsService.getThemaParadox();
  }

  /** GET /insights/verkiezingsanalyse — post-election MCS vs outcome analysis */
  @ApiOperation({ summary: "Verkiezingsanalyse 2026 — MCS vs election outcome for all municipalities" })
  @Get("verkiezingsanalyse")
  @Header("Cache-Control", "public, max-age=3600")
  async verkiezingsanalyse() {
    return this.insightsService.getVerkiezingsAnalyse();
  }

  /** GET /insights/belofte-van-de-week — weekly editorial promise highlight */
  @ApiOperation({ summary: "Belofte van de Week — the most notable promise-vote finding this week, optionally boosted by news keywords" })
  @ApiQuery({ name: "keywords", required: false, description: "Comma-separated news keywords to boost relevant promises (e.g. 'eigen risico,zorg,wonen')" })
  @Get("belofte-van-de-week")
  @Header("Cache-Control", "public, max-age=3600")
  async belofteVanDeWeek(@Query("keywords") keywords?: string) {
    const parsed = keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined;
    return this.insightsService.getBelofteVanDeWeek(parsed);
  }

  /** GET /insights/peilingen-divergentie — polling vs MCS divergence (national) */
  @ApiOperation({ summary: "Peilingen-MCS Divergentie — parties where polls diverge from promise-keeping" })
  @Get("peilingen-divergentie")
  @Header("Cache-Control", "public, max-age=3600")
  async peilingenDivergentie() {
    return this.peilingenMcsService.getDivergenceInsight();
  }

  /** GET /insights/eu-calendar — EU legislative calendar + party congresses */
  @ApiOperation({ summary: "EU Legislative Calendar — upcoming EU directives, party congresses, and NL relevance scoring" })
  @Get("eu-calendar")
  @Header("Cache-Control", "public, max-age=7200")
  async euCalendar() {
    return this.euCalendarService.getEuCalendar();
  }

  /** GET /insights/thema-audit — themes with high motion volume but low promise coverage */
  @ApiOperation({ summary: "Thema-audit — identifies themes with high parliamentary activity but low promise coverage" })
  @Get("thema-audit")
  @Header("Cache-Control", "public, max-age=7200")
  async themaAudit() {
    return this.insightsService.getThemaAudit();
  }

  /** GET /insights/defensie-tracker — regeerakkoord defense promise progress */
  @ApiOperation({ summary: "Defensie-tracker — tracks coalition agreement defense/foreign affairs promises with voting evidence" })
  @Get("defensie-tracker")
  @Header("Cache-Control", "public, max-age=3600")
  async defensieTracker() {
    return this.insightsService.getDefensieTracker();
  }
}
