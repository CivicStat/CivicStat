import { Controller, Get, Post, Body, Query, HttpCode } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from "@nestjs/swagger";
import { prisma } from "@ntp/db";

class CreateUpdateDto {
  title!: string;
  body!: string;
  category?: "NIEUWE_DATA" | "NIEUWE_ANALYSE" | "VERBETERING" | "BUGFIX";
  linkUrl?: string;
  linkLabel?: string;
  publishedAt?: string;
}

@ApiTags("updates")
@Controller("updates")
export class UpdatesController {
  @Get()
  @ApiOperation({ summary: "List platform updates (reverse chronological)" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "category", required: false, type: String })
  @ApiResponse({ status: 200, description: "List of platform updates" })
  async list(
    @Query("limit") limit?: string,
    @Query("category") category?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    const where: any = {};
    if (category) {
      where.category = category;
    }

    return prisma.platformUpdate.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take,
    });
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create a platform update (admin)" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["title", "body"],
      properties: {
        title: { type: "string", example: "Gemeentelijke MCS-scores voor Amsterdam en Den Haag" },
        body: { type: "string", example: "CivicStat volgt nu ook de gemeenteraden van Amsterdam en Den Haag." },
        category: { type: "string", enum: ["NIEUWE_DATA", "NIEUWE_ANALYSE", "VERBETERING", "BUGFIX"] },
        linkUrl: { type: "string", example: "/nl/gemeenten/amsterdam" },
        linkLabel: { type: "string", example: "Bekijk Amsterdam" },
        publishedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Update created" })
  async create(@Body() dto: CreateUpdateDto) {
    if (!dto.title || !dto.body) {
      return { error: "title and body are required" };
    }

    const update = await prisma.platformUpdate.create({
      data: {
        title: dto.title,
        body: dto.body,
        category: dto.category || null,
        linkUrl: dto.linkUrl || null,
        linkLabel: dto.linkLabel || null,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
      },
    });

    return { id: update.id, status: "created" };
  }
}
