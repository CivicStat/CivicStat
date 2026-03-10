import { Controller, Get, Query } from "@nestjs/common";
import { LangfuseService } from "./langfuse.service";

@Controller("langfuse")
export class LangfuseController {
  constructor(private readonly langfuseService: LangfuseService) {}

  /**
   * GET /langfuse/metrics
   * Aggregated AI usage metrics for the transparency page.
   */
  @Get("metrics")
  async getMetrics() {
    return this.langfuseService.getMetrics();
  }

  /**
   * GET /langfuse/traces?limit=20&page=1
   * Paginated list of AI traces with public Langfuse URLs.
   */
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
