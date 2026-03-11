import { Controller, Get, Header } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { InsightsService } from "./insights.service";

@ApiTags("insights")
@Controller("insights")
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  /** GET /insights — all four insight types in one response */
  @ApiOperation({ summary: "Get all automated insights", description: "Returns all insight types: onverwachte bedgenoten, coalitie scheuren, stijgers/dalers, and stille consensus." })
  @Get()
  @Header("Cache-Control", "public, max-age=3600")
  async all() {
    return this.insightsService.getAllInsights();
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
  @ApiOperation({ summary: "Stijgers en dalers — parties with biggest MCS changes" })
  @Get("beweging")
  @Header("Cache-Control", "public, max-age=3600")
  async beweging() {
    return this.insightsService.getStijgersDalers();
  }

  /** GET /insights/consensus — silent consensus motions */
  @ApiOperation({ summary: "Stille consensus — motions passed unanimously" })
  @Get("consensus")
  @Header("Cache-Control", "public, max-age=3600")
  async consensus() {
    return this.insightsService.getStilleConsensus();
  }
}
