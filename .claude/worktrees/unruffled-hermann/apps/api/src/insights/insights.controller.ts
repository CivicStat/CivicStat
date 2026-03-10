import { Controller, Get, Header } from "@nestjs/common";
import { InsightsService } from "./insights.service";

@Controller("insights")
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  /** GET /insights — all four insight types in one response */
  @Get()
  @Header("Cache-Control", "public, max-age=3600")
  async all() {
    return this.insightsService.getAllInsights();
  }

  /** GET /insights/bedgenoten — unlikely bedfellows */
  @Get("bedgenoten")
  @Header("Cache-Control", "public, max-age=3600")
  async bedgenoten() {
    return this.insightsService.getOnverwachteBedgenoten();
  }

  /** GET /insights/scheuren — coalition cracks */
  @Get("scheuren")
  @Header("Cache-Control", "public, max-age=3600")
  async scheuren() {
    return this.insightsService.getCoalitieScheuren();
  }

  /** GET /insights/beweging — biggest MCS movers */
  @Get("beweging")
  @Header("Cache-Control", "public, max-age=3600")
  async beweging() {
    return this.insightsService.getStijgersDalers();
  }

  /** GET /insights/consensus — silent consensus motions */
  @Get("consensus")
  @Header("Cache-Control", "public, max-age=3600")
  async consensus() {
    return this.insightsService.getStilleConsensus();
  }
}
