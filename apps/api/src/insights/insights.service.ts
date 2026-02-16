import { Injectable } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── Types ───────────────────────────────────────────────────

interface BedgenotenPair {
  partyA: string;
  partyB: string;
  agreementPct: number;
  sharedVotes: number;
  exampleMotion: { id: string; title: string; date: string } | null;
  note: string;
}

interface CoalitieScheur {
  motionId: string;
  motionTitle: string;
  date: string;
  coalitionName: string;
  dissenters: { abbreviation: string; vote: string }[];
  loyalists: { abbreviation: string; vote: string }[];
  note: string;
}

interface StijgerDaler {
  partyId: string;
  abbreviation: string;
  mcs2023: number;
  mcs2025: number;
  delta: number;
  note: string;
}

interface StilleConsensusMotion {
  motionId: string;
  title: string;
  date: string;
  result: string;
  unanimousPct: number;
  totalParties: number;
  note: string;
}

// Coalition definitions (mirrored from frontend)
const COALITIONS = [
  {
    name: "Kabinet-Schoof",
    year: 2024,
    parties: ["PVV", "VVD", "NSC", "BBB"],
  },
];

// Parties traditionally considered ideologically distant
const UNLIKELY_PAIRS = [
  ["PVV", "GL-PvdA"],
  ["PVV", "D66"],
  ["BBB", "GL-PvdA"],
  ["SP", "VVD"],
  ["PVV", "SP"],
  ["SGP", "D66"],
  ["DENK", "PVV"],
  ["PvdD", "VVD"],
  ["PvdD", "BBB"],
  ["FVD", "GL-PvdA"],
];

@Injectable()
export class InsightsService {
  /**
   * Returns all insights in one response for the frontend.
   */
  async getAllInsights() {
    const [bedgenoten, scheuren, beweging, consensus] =
      await Promise.allSettled([
        this.getOnverwachteBedgenoten(),
        this.getCoalitieScheuren(),
        this.getStijgersDalers(),
        this.getStilleConsensus(),
      ]);

    return {
      bedgenoten:
        bedgenoten.status === "fulfilled" ? bedgenoten.value : [],
      scheuren:
        scheuren.status === "fulfilled" ? scheuren.value : [],
      beweging:
        beweging.status === "fulfilled" ? beweging.value : [],
      consensus:
        consensus.status === "fulfilled" ? consensus.value : [],
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── 1. Onverwachte Bedgenoten ──────────────────────────────

  /**
   * Find "unlikely bedfellows" — ideologically distant parties
   * that vote together surprisingly often.
   */
  async getOnverwachteBedgenoten(): Promise<BedgenotenPair[]> {
    // Get all votes with party-level records
    const votes = await prisma.vote.findMany({
      where: {
        result: { in: ["Aangenomen", "Verworpen"] },
      },
      select: {
        id: true,
        motionId: true,
        date: true,
        motion: { select: { id: true, title: true, dateIntroduced: true } },
        records: {
          select: {
            voteValue: true,
            party: { select: { abbreviation: true } },
          },
        },
      },
      take: 500,
      orderBy: { date: "desc" },
    });

    // Build per-vote party stance map
    const pairStats = new Map<
      string,
      { agree: number; total: number; lastMotion: any }
    >();

    for (const vote of votes) {
      // Build party → stance map for this vote
      const partyStance = new Map<string, string>();
      for (const r of vote.records) {
        const abbr = r.party.abbreviation;
        // Only track FOR / AGAINST (ignore ABSTAIN/ABSENT)
        if (r.voteValue === "FOR" || r.voteValue === "AGAINST") {
          partyStance.set(abbr, r.voteValue);
        }
      }

      // Check unlikely pairs
      for (const [a, b] of UNLIKELY_PAIRS) {
        const stanceA = partyStance.get(a);
        const stanceB = partyStance.get(b);
        if (!stanceA || !stanceB) continue;

        const key = [a, b].sort().join("|");
        if (!pairStats.has(key)) {
          pairStats.set(key, { agree: 0, total: 0, lastMotion: null });
        }
        const stat = pairStats.get(key)!;
        stat.total++;
        if (stanceA === stanceB) {
          stat.agree++;
          stat.lastMotion = vote.motion;
        }
      }
    }

    // Filter to pairs with high agreement rate
    const results: BedgenotenPair[] = [];
    for (const [key, stat] of pairStats) {
      if (stat.total < 10) continue;
      const pct = Math.round((stat.agree / stat.total) * 100);
      if (pct < 50) continue; // Only report when >50% agreement

      const [partyA, partyB] = key.split("|");
      results.push({
        partyA,
        partyB,
        agreementPct: pct,
        sharedVotes: stat.total,
        exampleMotion: stat.lastMotion
          ? {
              id: stat.lastMotion.id,
              title: stat.lastMotion.title,
              date: stat.lastMotion.dateIntroduced,
            }
          : null,
        note: `${partyA} en ${partyB} stemden in ${pct}% van ${stat.total} stemmingen hetzelfde.`,
      });
    }

    return results.sort((a, b) => b.agreementPct - a.agreementPct).slice(0, 8);
  }

  // ─── 2. Coalitie-Scheuren ───────────────────────────────────

  /**
   * Find motions where coalition parties voted differently.
   */
  async getCoalitieScheuren(): Promise<CoalitieScheur[]> {
    const votes = await prisma.vote.findMany({
      where: {
        result: { in: ["Aangenomen", "Verworpen"] },
      },
      select: {
        id: true,
        motionId: true,
        date: true,
        motion: { select: { id: true, title: true, dateIntroduced: true } },
        records: {
          select: {
            voteValue: true,
            party: { select: { abbreviation: true } },
          },
        },
      },
      take: 500,
      orderBy: { date: "desc" },
    });

    const results: CoalitieScheur[] = [];

    for (const coalition of COALITIONS) {
      for (const vote of votes) {
        // Build party stance
        const partyStance = new Map<string, string>();
        for (const r of vote.records) {
          if (r.voteValue === "FOR" || r.voteValue === "AGAINST") {
            partyStance.set(r.party.abbreviation, r.voteValue);
          }
        }

        // Check if all coalition parties voted
        const coalitionVotes: { abbreviation: string; vote: string }[] = [];
        for (const party of coalition.parties) {
          const stance = partyStance.get(party);
          if (stance) coalitionVotes.push({ abbreviation: party, vote: stance });
        }

        if (coalitionVotes.length < 3) continue; // Need at least 3 coalition parties

        // Check for disagreement
        const majorityVote = coalitionVotes[0].vote;
        const dissenters = coalitionVotes.filter((v) => v.vote !== majorityVote);

        // If there's at least 1 dissenter, it's a crack
        if (dissenters.length > 0 && dissenters.length < coalitionVotes.length) {
          // Determine minority vs majority properly
          const forCount = coalitionVotes.filter((v) => v.vote === "FOR").length;
          const againstCount = coalitionVotes.filter((v) => v.vote === "AGAINST").length;
          const majorVote = forCount >= againstCount ? "FOR" : "AGAINST";

          const loyalists = coalitionVotes.filter((v) => v.vote === majorVote);
          const rebels = coalitionVotes.filter((v) => v.vote !== majorVote);

          results.push({
            motionId: vote.motion?.id ?? vote.motionId ?? "",
            motionTitle: vote.motion?.title ?? "Onbekend",
            date: vote.motion?.dateIntroduced
              ? String(vote.motion.dateIntroduced)
              : vote.date
                ? vote.date.toISOString()
                : "",
            coalitionName: coalition.name,
            dissenters: rebels,
            loyalists,
            note: `${rebels.map((r) => r.abbreviation).join(", ")} stemde${rebels.length === 1 ? "" : "n"} anders dan de rest van de ${coalition.name}-coalitie.`,
          });
        }
      }
    }

    // Sort by date descending, return top 10
    return results
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }

  // ─── 3. Stijgers & Dalers ──────────────────────────────────

  /**
   * Find parties with the biggest MCS change between TK2023 and TK2025.
   */
  async getStijgersDalers(): Promise<StijgerDaler[]> {
    const scorecards = await prisma.precomputedScorecard.findMany({
      where: {
        electionYear: { in: [2023, 2025] },
        scoredPromises: { gt: 0 },
      },
      select: {
        partyId: true,
        electionYear: true,
        mcs: true,
        scoredPromises: true,
        party: { select: { abbreviation: true } },
      },
    });

    // Group by party
    const byParty = new Map<
      string,
      { partyId: string; abbreviation: string; mcs2023?: number; mcs2025?: number }
    >();

    for (const sc of scorecards) {
      if (!byParty.has(sc.partyId)) {
        byParty.set(sc.partyId, {
          partyId: sc.partyId,
          abbreviation: sc.party.abbreviation,
        });
      }
      const entry = byParty.get(sc.partyId)!;
      if (sc.electionYear === 2023) entry.mcs2023 = sc.mcs;
      if (sc.electionYear === 2025) entry.mcs2025 = sc.mcs;
    }

    const results: StijgerDaler[] = [];
    for (const entry of byParty.values()) {
      if (entry.mcs2023 == null || entry.mcs2025 == null) continue;
      const delta = entry.mcs2025 - entry.mcs2023;
      results.push({
        partyId: entry.partyId,
        abbreviation: entry.abbreviation,
        mcs2023: entry.mcs2023,
        mcs2025: entry.mcs2025,
        delta,
        note:
          delta > 0
            ? `${entry.abbreviation} steeg ${delta} punten (van ${entry.mcs2023} naar ${entry.mcs2025}).`
            : delta < 0
              ? `${entry.abbreviation} daalde ${Math.abs(delta)} punten (van ${entry.mcs2023} naar ${entry.mcs2025}).`
              : `${entry.abbreviation} bleef stabiel op ${entry.mcs2023}.`,
      });
    }

    return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  // ─── 4. Stille Consensus ───────────────────────────────────

  /**
   * Find motions where (almost) all parties voted the same way
   * — surprising unanimity.
   */
  async getStilleConsensus(): Promise<StilleConsensusMotion[]> {
    const votes = await prisma.vote.findMany({
      where: {
        result: { in: ["Aangenomen", "Verworpen"] },
      },
      select: {
        id: true,
        motionId: true,
        result: true,
        date: true,
        motion: { select: { id: true, title: true, dateIntroduced: true } },
        records: {
          select: {
            voteValue: true,
            party: { select: { abbreviation: true } },
          },
        },
      },
      take: 500,
      orderBy: { date: "desc" },
    });

    const results: StilleConsensusMotion[] = [];

    for (const vote of votes) {
      // Group by party → majority stance
      const partyStances = new Map<string, string>();
      const partyCounts = new Map<string, { for: number; against: number }>();

      for (const r of vote.records) {
        const abbr = r.party.abbreviation;
        if (!partyCounts.has(abbr)) partyCounts.set(abbr, { for: 0, against: 0 });
        const counts = partyCounts.get(abbr)!;
        if (r.voteValue === "FOR") counts.for++;
        else if (r.voteValue === "AGAINST") counts.against++;
      }

      for (const [abbr, counts] of partyCounts) {
        if (counts.for > 0 || counts.against > 0) {
          partyStances.set(abbr, counts.for >= counts.against ? "FOR" : "AGAINST");
        }
      }

      if (partyStances.size < 5) continue; // Need at least 5 parties

      // Check unanimity
      const forParties = [...partyStances.values()].filter((v) => v === "FOR").length;
      const againstParties = [...partyStances.values()].filter((v) => v === "AGAINST").length;
      const total = partyStances.size;
      const majorityPct = Math.round(
        (Math.max(forParties, againstParties) / total) * 100,
      );

      if (majorityPct >= 90) {
        results.push({
          motionId: vote.motion?.id ?? vote.motionId ?? "",
          title: vote.motion?.title ?? "Onbekend",
          date: vote.motion?.dateIntroduced
            ? String(vote.motion.dateIntroduced)
            : vote.date
              ? vote.date.toISOString()
              : "",
          result: vote.result ?? "",
          unanimousPct: majorityPct,
          totalParties: total,
          note: `${majorityPct}% van ${total} partijen stemde ${forParties > againstParties ? "voor" : "tegen"} deze motie.`,
        });
      }
    }

    return results
      .sort((a, b) => b.unanimousPct - a.unanimousPct || new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }
}
