import { Controller, Get, Param } from "@nestjs/common";
import { ParliamentService } from "./parliament.service";

/**
 * Parliament CRUD endpoints:
 *   GET /parliaments              → list all parliaments
 *   GET /parliaments/:slug        → parliament detail
 */
@Controller("parliaments")
export class ParliamentController {
  constructor(private readonly parliamentService: ParliamentService) {}

  @Get()
  async list() {
    return this.parliamentService.list();
  }

  @Get(":slug")
  async get(@Param("slug") slug: string) {
    return this.parliamentService.get(slug);
  }
}
