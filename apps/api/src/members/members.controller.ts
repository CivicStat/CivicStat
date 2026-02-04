import { Controller, Get, Param, Query } from "@nestjs/common";
import { MembersService } from "./members.service";

@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  async list(
    @Query("party") party?: string,
    @Query("active") active?: string
  ) {
    return this.membersService.list({
      party,
      active: active !== "false", // Default true
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.membersService.get(id);
  }
}
