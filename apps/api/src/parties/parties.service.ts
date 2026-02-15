import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

@Injectable()
export class PartiesService {
  async list() {
    const parties = await prisma.party.findMany({
      where: {
        OR: [
          // Active parties (no end date or end date in future)
          { endDate: null },
          { endDate: { gte: new Date() } },
          // Parties with a 2023 program (current parliamentary term)
          { programs: { some: { electionYear: 2023 } } },
        ],
      },
      orderBy: { abbreviation: "asc" },
      include: {
        _count: {
          select: {
            mps: true,
          },
        },
      },
    });

    return parties.map((p) => ({
      ...p,
      seats: p.seats ?? 0,
    }));
  }

  async get(idOrAbbr: string) {
    const party = await this.findParty(idOrAbbr);

    // Get current MPs
    const mps = await prisma.mp.findMany({
      where: {
        partyId: party.id,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      orderBy: { surname: "asc" },
      select: {
        id: true,
        tkId: true,
        name: true,
        surname: true,
        startDate: true,
        endDate: true,
      },
    });

    // Get voting stats
    const voteStats = await this.getPartyVoteStats(party.id);

    return {
      ...party,
      seats: party.seats ?? 0,
      mps,
      voteStats,
    };
  }

  async getPartyVoteStats(partyId: string) {
    const records = await prisma.voteRecord.findMany({
      where: {
        partyIdSnapshot: partyId,
        vote: {
          date: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
          },
        },
      },
      include: {
        vote: {
          select: {
            result: true,
          },
        },
      },
    });

    let totalFor = 0;
    let totalAgainst = 0;
    let totalAbstain = 0;
    let votesWon = 0;
    let votesLost = 0;

    for (const record of records) {
      switch (record.voteValue) {
        case "FOR":
          totalFor++;
          if (record.vote.result === "Aangenomen") votesWon++;
          break;
        case "AGAINST":
          totalAgainst++;
          if (record.vote.result === "Verworpen") votesWon++;
          break;
        case "ABSTAIN":
          totalAbstain++;
          break;
      }
    }

    return {
      totalVotes: records.length,
      for: totalFor,
      against: totalAgainst,
      abstain: totalAbstain,
      votesWon,
      votesLost: records.length - votesWon - totalAbstain,
    };
  }

  private async findParty(idOrAbbr: string) {
    // UUID format check — only query by id if it looks like a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrAbbr);

    if (isUuid) {
      const byId = await prisma.party.findUnique({
        where: { id: idOrAbbr },
      });
      if (byId) return byId;
    }

    const byTkId = await prisma.party.findUnique({
      where: { tkId: idOrAbbr },
    });
    if (byTkId) return byTkId;

    const byAbbr = await prisma.party.findFirst({
      where: {
        abbreviation: {
          equals: idOrAbbr,
          mode: "insensitive",
        },
      },
    });

    if (!byAbbr) {
      throw new NotFoundException("Party not found");
    }

    return byAbbr;
  }
}
