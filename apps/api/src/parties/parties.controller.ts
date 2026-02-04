import { Controller, Get, Param } from "@nestjs/common";
import { PartiesService } from "./parties.service";

@Controller("parties")
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  async list() {
    return this.partiesService.list();
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.partiesService.get(id);
  }
}
