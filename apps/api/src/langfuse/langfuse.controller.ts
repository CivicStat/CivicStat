import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { LangfuseService } from "./langfuse.service";

@ApiTags("transparency")
@Controller("langfuse")
export class LangfuseController {
  constructor(private readonly langfuseService: LangfuseService) {}

  /**
   * GET /langfuse/metrics
   * Aggregated AI usage metrics for the transparency page.
   */
  @ApiOperation({ summary: "Get AI usage metrics", description: "Aggregated metrics from Langfuse for the transparency page." })
  @Get("metrics")
  async getMetrics() {
    return this.langfuseService.getMetrics();
  }

  /**
   * GET /langfuse/traces?limit=20&page=1
   * Paginated list of AI traces with public Langfuse URLs.
   */
  @ApiOperation({ summary: "Get AI trace log", description: "Paginated list of AI matching traces with public Langfuse URLs for transparency." })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "page", required: false })
  @Get("traces")
  async getTraces(
    @Query("limit") limit?: string,
    @Query("page") page?: string,
  ) {
    return this.langfuseService.getTraces(
      limit ? parseInt(limit, 10) : 20,
      page ? parseInt(page, 10) : 1,
    );
  }
}
