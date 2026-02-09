import {
  Controller,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
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
    try {
      return await this.scorecardService.getScorecard(id);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`Scorecard computation failed for ${id}:`, err);
      throw new InternalServerErrorException("Scorecard computation failed");
    }
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.partiesService.get(id);
  }
}
