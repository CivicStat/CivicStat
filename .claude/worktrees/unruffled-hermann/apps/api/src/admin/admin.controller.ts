import { Controller, Get, Query } from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("status")
  async getStatus() {
    return this.adminService.getStatus();
  }

  @Get("pipeline-runs")
  async getPipelineRuns(@Query("limit") limit?: string) {
    return this.adminService.getPipelineRuns(limit ? parseInt(limit) : 20);
  }
}
