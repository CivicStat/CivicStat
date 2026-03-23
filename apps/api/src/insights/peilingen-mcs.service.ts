import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── Types ──────────────────────────────────────────────────

export interface PollMcsCorrelationEntry {
  partyId: string;
  abbreviation: string;
  mcs: number;
  latestSeats: number;
  seatsTrend: number;
  category: "beloond" | "bestraft" | "overschat" | "onderschat" | "neutraal";
  pollingTimeSeries: { date: string; seats: number }[];
}

export interface PollMcsCorrelationView {
  parliamentSlug: string;
  parliamentName: string;
  generatedAt: string;
  pollSource: string;
  pollDateRange: { from: string; to: string };
  pollDates: string[];
  spearmanRho: number | null;
  correlationStrength: "sterk" | "matig" | "zwak" | null;
  correlationDirection: "positief" | "negatief" | "neutraal" | null;
  narrative: string;
  parties: PollMcsCorrelationEntry[];
}

export interface PeilingenMcsEntry {
  partyId: string;
  abbreviation: string;
  mcs: number | null;
  latestSeats: number | null;
  seatsTrend: number; // change over polling window (positive = gaining)
  mcsRank: number;
  pollRank: number;
  divergenceIndex: number; // normalized rank difference (positive = polls better than MCS)
  category: "beloond" | "bestraft" | "overschat" | "onderschat" | "neutraal";
  note: string;
}

export interface PeilingenMcsDivergence {
  parliamentSlug: string;
  parliamentName: string;
  generatedAt: string;
  pollSource: string;
  pollDateRange: { from: string; to: string };
  parties: PeilingenMcsEntry[];
  topFindings: string[];
}

@Injectable()
export class PeilingenMcsService {
  /**
   * Compute the Peilingen-MCS Divergentiemeter for a parliament.
   *
   * For each party:
   * 1. Get latest MCS from PrecomputedScorecard
   * 2. Get latest polling seats + trend from PollingSnapshot
   * 3. Rank parties by MCS and by poll seats
   * 4. Divergence = pollRank - mcsRank (positive = polls reward beyond MCS merit)
   * 5. Categorize: beloond (high MCS + gaining), bestraft (high MCS + losing),
   *    overschat (low MCS + gaining), onderschat (low MCS + losing), neutraal
   */
  async getDivergence(parliamentSlug: string): Promise<PeilingenMcsDivergence> {
    const parliament = await prisma.parliament.findUnique({
      where: { slug: parliamentSlug },
    });
    if (!parliament) throw new NotFoundException(`Parliament ${parliamentSlug} not found`);

    // 1. Get latest scorecards (most recent election year)
    const scorecards = await prisma.precomputedScorecard.findMany({
      where: { parliamentId: parliament.id },
      orderBy: { electionYear: "desc" },
      select: {
        partyId: true,
        mcs: true,
        electionYear: true,
        party: { select: { abbreviation: true } },
      },
    });

    // Deduplicate: keep most recent year per party
    const mcsMap = new Map<string, { mcs: number; abbreviation: string }>();
    for (const sc of scorecards) {
      if (!mcsMap.has(sc.partyId)) {
        mcsMap.set(sc.partyId, { mcs: sc.mcs, abbreviation: sc.party.abbreviation });
      }
    }

    // 2. Get polling snapshots (all dates, ordered)
    const polls = await prisma.pollingSnapshot.findMany({
      where: { parliamentId: parliament.id },
      orderBy: { pollDate: "asc" },
      select: {
        partyId: true,
        pollDate: true,
        seats: true,
        party: { select: { abbreviation: true } },
      },
    });

    if (polls.length === 0) {
      return {
        parliamentSlug,
        parliamentName: parliament.name,
        generatedAt: new Date().toISOString(),
        pollSource: "peilingwijzer",
        pollDateRange: { from: "", to: "" },
        parties: [],
        topFindings: ["Geen peilingdata beschikbaar voor dit parlement."],
      };
    }

    // Group polls by party
    const pollsByParty = new Map<string, { date: Date; seats: number; abbr: string }[]>();
    for (const poll of polls) {
      if (poll.seats == null) continue;
      const list = pollsByParty.get(poll.partyId) || [];
      list.push({ date: poll.pollDate, seats: poll.seats, abbr: poll.party.abbreviation });
      pollsByParty.set(poll.partyId, list);
    }

    // Date range
    const allDates = polls.map((p) => p.pollDate);
    const dateFrom = allDates[0].toISOString().split("T")[0];
    const dateTo = allDates[allDates.length - 1].toISOString().split("T")[0];

    // 3. Build combined entries (parties that have both MCS and polling data)
    const entries: PeilingenMcsEntry[] = [];
    for (const [partyId, mcsData] of mcsMap) {
      const partyPolls = pollsByParty.get(partyId);
      if (!partyPolls || partyPolls.length === 0) continue;

      const latestSeats = partyPolls[partyPolls.length - 1].seats;
      const firstSeats = partyPolls[0].seats;
      const seatsTrend = latestSeats - firstSeats;

      entries.push({
        partyId,
        abbreviation: mcsData.abbreviation,
        mcs: mcsData.mcs,
        latestSeats,
        seatsTrend,
        mcsRank: 0, // filled below
        pollRank: 0, // filled below
        divergenceIndex: 0, // filled below
        category: "neutraal",
        note: "",
      });
    }

    // Also include parties with polling data but no MCS
    for (const [partyId, partyPolls] of pollsByParty) {
      if (mcsMap.has(partyId)) continue;
      const latestSeats = partyPolls[partyPolls.length - 1].seats;
      const firstSeats = partyPolls[0].seats;
      entries.push({
        partyId,
        abbreviation: partyPolls[0].abbr,
        mcs: null,
        latestSeats,
        seatsTrend: latestSeats - firstSeats,
        mcsRank: 0,
        pollRank: 0,
        divergenceIndex: 0,
        category: "neutraal",
        note: "",
      });
    }

    // 4. Rank by MCS (descending) — parties without MCS get last rank
    const withMcs = entries.filter((e) => e.mcs !== null);
    withMcs.sort((a, b) => (b.mcs ?? 0) - (a.mcs ?? 0));
    withMcs.forEach((e, i) => (e.mcsRank = i + 1));
    const noMcs = entries.filter((e) => e.mcs === null);
    noMcs.forEach((e) => (e.mcsRank = withMcs.length + 1));

    // Rank by poll seats (descending)
    const sorted = [...entries].sort((a, b) => (b.latestSeats ?? 0) - (a.latestSeats ?? 0));
    sorted.forEach((e, i) => (e.pollRank = i + 1));

    // 5. Compute divergence and categorize
    const n = entries.length;
    for (const e of entries) {
      if (e.mcs === null) {
        e.divergenceIndex = 0;
        e.category = "neutraal";
        e.note = `${e.abbreviation}: geen MCS-score beschikbaar.`;
        continue;
      }

      // Divergence: positive = polls rank higher than MCS rank (overperforming in polls)
      // Normalize to [-1, 1] range
      e.divergenceIndex = n > 1
        ? (e.mcsRank - e.pollRank) / (n - 1)
        : 0;

      // Categorize based on MCS level and seat trend
      const highMcs = e.mcs >= 60;
      const gaining = e.seatsTrend > 0;
      const losing = e.seatsTrend < 0;

      if (highMcs && gaining) {
        e.category = "beloond";
        e.note = `${e.abbreviation} houdt beloftes na (MCS ${e.mcs.toFixed(0)}) en wordt beloond in de peilingen (+${e.seatsTrend} zetels).`;
      } else if (highMcs && losing) {
        e.category = "bestraft";
        e.note = `${e.abbreviation} houdt beloftes na (MCS ${e.mcs.toFixed(0)}) maar verliest toch in de peilingen (${e.seatsTrend} zetels).`;
      } else if (!highMcs && gaining) {
        e.category = "overschat";
        e.note = `${e.abbreviation} breekt beloftes (MCS ${e.mcs.toFixed(0)}) maar groeit in de peilingen (+${e.seatsTrend} zetels).`;
      } else if (!highMcs && losing) {
        e.category = "onderschat";
        e.note = `${e.abbreviation} breekt beloftes (MCS ${e.mcs.toFixed(0)}) en wordt afgestraft in de peilingen (${e.seatsTrend} zetels).`;
      } else {
        e.category = "neutraal";
        e.note = `${e.abbreviation}: MCS ${e.mcs.toFixed(0)}, peilingen stabiel (${e.latestSeats} zetels).`;
      }
    }

    // Sort by absolute divergence (most divergent first)
    entries.sort((a, b) => Math.abs(b.divergenceIndex) - Math.abs(a.divergenceIndex));

    // 6. Generate top findings
    const topFindings: string[] = [];

    const beloond = entries.filter((e) => e.category === "beloond");
    if (beloond.length > 0) {
      topFindings.push(
        `Beloftehouders beloond: ${beloond.map((e) => e.abbreviation).join(", ")} — hoge MCS en stijgende peilingen.`,
      );
    }

    const onderschat = entries.filter((e) => e.category === "onderschat");
    if (onderschat.length > 0) {
      topFindings.push(
        `Beloftebrekers bestraft: ${onderschat.map((e) => e.abbreviation).join(", ")} — lage MCS en dalende peilingen.`,
      );
    }

    const overschat = entries.filter((e) => e.category === "overschat");
    if (overschat.length > 0) {
      topFindings.push(
        `Overschat door kiezers: ${overschat.map((e) => e.abbreviation).join(", ")} — lage MCS maar stijgende peilingen.`,
      );
    }

    const bestraft = entries.filter((e) => e.category === "bestraft");
    if (bestraft.length > 0) {
      topFindings.push(
        `Ondanks beloftetrouw dalend: ${bestraft.map((e) => e.abbreviation).join(", ")} — hoge MCS maar dalende peilingen.`,
      );
    }

    return {
      parliamentSlug,
      parliamentName: parliament.name,
      generatedAt: new Date().toISOString(),
      pollSource: "peilingwijzer",
      pollDateRange: { from: dateFrom, to: dateTo },
      parties: entries,
      topFindings,
    };
  }

  /**
   * Poll-MCS Correlation View: scatter data + time series + Spearman rho.
   */
  async getCorrelationView(parliamentSlug: string): Promise<PollMcsCorrelationView> {
    const parliament = await prisma.parliament.findUnique({
      where: { slug: parliamentSlug },
    });
    if (!parliament) throw new NotFoundException(`Parliament ${parliamentSlug} not found`);

    // Get latest MCS per party
    const scorecards = await prisma.precomputedScorecard.findMany({
      where: { parliamentId: parliament.id },
      orderBy: { electionYear: "desc" },
      select: {
        partyId: true,
        mcs: true,
        party: { select: { abbreviation: true } },
      },
    });
    const mcsMap = new Map<string, { mcs: number; abbreviation: string }>();
    for (const sc of scorecards) {
      if (!mcsMap.has(sc.partyId)) {
        mcsMap.set(sc.partyId, { mcs: sc.mcs, abbreviation: sc.party.abbreviation });
      }
    }

    // Get all polling snapshots
    const polls = await prisma.pollingSnapshot.findMany({
      where: { parliamentId: parliament.id },
      orderBy: { pollDate: "asc" },
      select: {
        partyId: true,
        pollDate: true,
        seats: true,
        party: { select: { abbreviation: true } },
      },
    });

    if (polls.length === 0) {
      return {
        parliamentSlug,
        parliamentName: parliament.name,
        generatedAt: new Date().toISOString(),
        pollSource: "peilingwijzer",
        pollDateRange: { from: "", to: "" },
        pollDates: [],
        spearmanRho: null,
        correlationStrength: null,
        correlationDirection: null,
        narrative: "Geen peilingdata beschikbaar voor dit parlement.",
        parties: [],
      };
    }

    // Group polls by party
    const pollsByParty = new Map<string, { date: string; seats: number }[]>();
    const allDatesSet = new Set<string>();
    for (const poll of polls) {
      if (poll.seats == null) continue;
      const dateStr = poll.pollDate.toISOString().split("T")[0];
      allDatesSet.add(dateStr);
      const list = pollsByParty.get(poll.partyId) || [];
      list.push({ date: dateStr, seats: poll.seats });
      pollsByParty.set(poll.partyId, list);
    }

    const pollDates = [...allDatesSet].sort();
    const dateFrom = pollDates[0];
    const dateTo = pollDates[pollDates.length - 1];

    // Build entries: only parties with BOTH MCS and polling data
    const entries: PollMcsCorrelationEntry[] = [];
    for (const [partyId, mcsData] of mcsMap) {
      const partyPolls = pollsByParty.get(partyId);
      if (!partyPolls || partyPolls.length === 0) continue;

      const latestSeats = partyPolls[partyPolls.length - 1].seats;
      const firstSeats = partyPolls[0].seats;
      const seatsTrend = latestSeats - firstSeats;

      const highMcs = mcsData.mcs >= 60;
      const gaining = seatsTrend > 0;
      const losing = seatsTrend < 0;
      let category: PollMcsCorrelationEntry["category"] = "neutraal";
      if (highMcs && gaining) category = "beloond";
      else if (highMcs && losing) category = "bestraft";
      else if (!highMcs && gaining) category = "overschat";
      else if (!highMcs && losing) category = "onderschat";

      entries.push({
        partyId,
        abbreviation: mcsData.abbreviation,
        mcs: mcsData.mcs,
        latestSeats,
        seatsTrend,
        category,
        pollingTimeSeries: partyPolls,
      });
    }

    // Compute Spearman rank correlation between MCS and latest seats
    let spearmanRho: number | null = null;
    let correlationStrength: PollMcsCorrelationView["correlationStrength"] = null;
    let correlationDirection: PollMcsCorrelationView["correlationDirection"] = null;

    if (entries.length >= 3) {
      // Rank by MCS descending
      const byMcs = [...entries].sort((a, b) => b.mcs - a.mcs);
      const mcsRankMap = new Map<string, number>();
      byMcs.forEach((e, i) => mcsRankMap.set(e.partyId, i + 1));

      // Rank by latest seats descending
      const bySeats = [...entries].sort((a, b) => b.latestSeats - a.latestSeats);
      const seatsRankMap = new Map<string, number>();
      bySeats.forEach((e, i) => seatsRankMap.set(e.partyId, i + 1));

      // Spearman: rho = 1 - (6 * sum(d^2)) / (n * (n^2 - 1))
      const n = entries.length;
      let sumD2 = 0;
      for (const e of entries) {
        const d = (mcsRankMap.get(e.partyId) ?? 0) - (seatsRankMap.get(e.partyId) ?? 0);
        sumD2 += d * d;
      }
      spearmanRho = 1 - (6 * sumD2) / (n * (n * n - 1));
      spearmanRho = Math.round(spearmanRho * 1000) / 1000;

      const absRho = Math.abs(spearmanRho);
      correlationStrength = absRho > 0.6 ? "sterk" : absRho > 0.3 ? "matig" : "zwak";
      correlationDirection = spearmanRho > 0.3 ? "positief" : spearmanRho < -0.3 ? "negatief" : "neutraal";
    }

    // Generate narrative
    let narrative: string;
    if (spearmanRho === null) {
      narrative = "Te weinig partijen met MCS en peilingdata om een correlatie te berekenen.";
    } else if (correlationDirection === "positief") {
      narrative =
        `Spearman-rangcorrelatie: ${spearmanRho.toFixed(2)} (${correlationStrength}). ` +
        `Partijen die hun beloftes nakomen staan hoger in de peilingen — kiezers belonen beloftetrouw.`;
    } else if (correlationDirection === "negatief") {
      narrative =
        `Spearman-rangcorrelatie: ${spearmanRho.toFixed(2)} (${correlationStrength}). ` +
        `Partijen met een lage MCS scoren juist beter in de peilingen — beloftetrouw wordt niet beloond.`;
    } else {
      narrative =
        `Spearman-rangcorrelatie: ${spearmanRho.toFixed(2)} (${correlationStrength}). ` +
        `Er is geen duidelijk verband tussen beloftetrouw en peilingresultaten.`;
    }

    // Sort by MCS descending for scatter readability
    entries.sort((a, b) => b.mcs - a.mcs);

    return {
      parliamentSlug,
      parliamentName: parliament.name,
      generatedAt: new Date().toISOString(),
      pollSource: "peilingwijzer",
      pollDateRange: { from: dateFrom, to: dateTo },
      pollDates,
      spearmanRho,
      correlationStrength,
      correlationDirection,
      narrative,
      parties: entries,
    };
  }

  /**
   * Get a summary for the insights aggregator (national only).
   */
  async getDivergenceInsight(): Promise<PeilingenMcsEntry[]> {
    try {
      const result = await this.getDivergence("tweede-kamer");
      return result.parties.filter((p) => p.mcs !== null).slice(0, 10);
    } catch {
      return [];
    }
  }
}
