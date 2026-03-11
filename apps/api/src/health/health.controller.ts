import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @ApiOperation({ summary: "Service health check" })
  @Get()
  status() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString()
    };
  }
}
