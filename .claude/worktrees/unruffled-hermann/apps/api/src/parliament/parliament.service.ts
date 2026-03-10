import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

@Injectable()
export class ParliamentService {
  /**
   * List all active parliaments.
   */
  async list() {
    return prisma.parliament.findMany({
      where: { active: true },
      orderBy: [{ level: "asc" }, { shortName: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        level: true,
        country: true,
        municipality: true,
        seats: true,
        active: true,
        _count: {
          select: {
            motions: true,
            parties: true,
            mps: true,
            votes: true,
          },
        },
      },
    });
  }

  /**
   * Find a parliament by slug, throwing NotFoundException if not found.
   */
  async findBySlug(slug: string) {
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
    });

    if (!parliament) {
      throw new NotFoundException(`Parliament "${slug}" not found`);
    }

    return parliament;
  }

  /**
   * Get parliament detail with summary stats.
   */
  async get(slug: string) {
    const parliament = await prisma.parliament.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            motions: true,
            parties: true,
            mps: true,
            votes: true,
            programs: true,
          },
        },
      },
    });

    if (!parliament) {
      throw new NotFoundException(`Parliament "${slug}" not found`);
    }

    return parliament;
  }

  /**
   * Resolve a parliament slug to its ID.
   * Defaults to "tweede-kamer" if no slug provided.
   */
  async resolveParliamentId(slug?: string): Promise<string | undefined> {
    if (!slug) return undefined; // No filter = all parliaments (backward compat)
    const parliament = await this.findBySlug(slug);
    return parliament.id;
  }
}
