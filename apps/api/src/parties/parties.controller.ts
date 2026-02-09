import { Controller, Get, Param } from "@nestjs/common";
import { PartiesService } from "./parties.service";
import { PartiesScorecardService } from "./parties-scorecard.service";

@Controller("parties")
export class PartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly scorecardService: PartiesScorecardService,
  ) {}

  @Get()
  async list() {
    return this.partiesService.list();
  }

  @Get("scorecards")
  async scorecards() {
    return this.scorecardService.getAllScorecards();
  }

  @Get(":id/scorecard")
  async scorecard(@Param("id") id: string) {
    return this.scorecardService.getScorecard(id);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.partiesService.get(id);
  }
}
