import { Controller, Get, Param } from "@nestjs/common";
import { PartiesService } from "./parties.service";
import { ParliamentService } from "../parliament/parliament.service";

/**
 * Parliament-scoped parties:
 *   GET /parliament/:slug/parties
 *   GET /parliament/:slug/parties/:id
 */
@Controller("parliament/:slug/parties")
export class ScopedPartiesController {
  constructor(
    private readonly partiesService: PartiesService,
    private readonly parliamentService: ParliamentService,
  ) {}

  @Get()
  async list(@Param("slug") slug: string) {
    const parliamentId = await this.parliamentService.resolveParliamentId(slug);
    return this.partiesService.list({ parliamentId });
  }

  @Get(":id")
  async get(@Param("slug") slug: string, @Param("id") id: string) {
    await this.parliamentService.findBySlug(slug);
    return this.partiesService.get(id);
  }
}
