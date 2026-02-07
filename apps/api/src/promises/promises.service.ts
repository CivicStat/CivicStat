import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

interface ListOptions {
  party?: string;
  year?: number;
  theme?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PromisesService {
  async list(options: ListOptions = {}) {
    const { party, year, theme, limit = 50, offset = 0 } = options;

    const where: any = {};

    if (party) {
      where.program = {
        party: {
          abbreviation: { equals: party, mode: "insensitive" },
        },
      };
    }

    if (year) {
      where.program = {
        ...where.program,
        electionYear: year,
      };
    }

    if (theme) {
      where.theme = theme.toUpperCase();
    }
