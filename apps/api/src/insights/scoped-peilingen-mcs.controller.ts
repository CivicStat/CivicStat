import { Controller, Get, Header, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PeilingenMcsService } from "./peilingen-mcs.service";

@ApiTags("parliament-scoped")
@Controller("parliament/:slug")
export class ScopedPeilingenMcsController {
  constructor(private readonly peilingenMcsService: PeilingenMcsService) {}

  /** GET /parliament/:slug/peilingen-mcs — polling vs MCS divergence */
  @ApiOperation({
    summary: "Peilingen-MCS Divergentiemeter — polling trend vs promise-keeping score",
    description:
      "Compares party polling trends (Peilingwijzer) with MCS scores to identify " +
      "parties where public support diverges from promise-keeping performance.",
  })
  @ApiParam({ name: "slug", description: "Parliament slug (e.g. tweede-kamer, amsterdam)" })
  @Get("peilingen-mcs")
  @Header("Cache-Control", "public, max-age=3600")
  async peilingenMcs(@Param("slug") slug: string) {
    return this.peilingenMcsService.getDivergence(slug);
  }

  /** GET /parliament/:slug/poll-mcs-correlation — scatter + time-series + Spearman rho */
  @ApiOperation({
    summary: "Poll-MCS Correlation View — scatter plot data with Spearman rank correlation",
    description:
      "Returns MCS scores plotted against polling trajectories per party, " +
      "with full polling time series and a Spearman rank correlation coefficient. " +
      "Designed for scatter/time-series visualisation.",
  })
  @ApiParam({ name: "slug", description: "Parliament slug (e.g. tweede-kamer, amsterdam)" })
  @Get("poll-mcs-correlation")
  @Header("Cache-Control", "public, max-age=3600")
  async pollMcsCorrelation(@Param("slug") slug: string) {
    return this.peilingenMcsService.getCorrelationView(slug);
  }
}
