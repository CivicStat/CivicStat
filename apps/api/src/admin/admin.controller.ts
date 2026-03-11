import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: "Get admin status and sync state" })
  @Get("status")
  async getStatus() {
    return this.adminService.getStatus();
  }

  @ApiOperation({ summary: "Get recent ETL pipeline runs" })
  @ApiQuery({ name: "limit", required: false })
  @Get("pipeline-runs")
  async getPipelineRuns(@Query("limit") limit?: string) {
    return this.adminService.getPipelineRuns(limit ? parseInt(limit) : 20);
  }
}
