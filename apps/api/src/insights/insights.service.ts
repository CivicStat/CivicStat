import { Injectable } from "@nestjs/common";
import { prisma } from "@ntp/db";
import {
  COALITIONS,
  TRACKED_PARTIES,
  UNLIKELY_PAIRS,
  extractPartyStances,
} from "../coalitions/coalitions.config";

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

interface BeloftehouderEntry {
  partyId: string;
  abbreviation: string;
  mcs: number;
  scoredPromises: number;
  rank: number;
  note: string;
}

interface ThemaKloofEntry {
  theme: string;
  coalitionName: string;
  avgMcs: number;
  parties: { abbreviation: string; mcs: number }[];
  note: string;
}

interface RebelMpEntry {
  mpId: string;
  name: string;
  surname: string;
  abbreviation: string;
  totalVotes: number;
  deviations: number;
  deviationPct: number;
  note: string;
}

interface VerwateringEntry {
  partyId: string;
  abbreviation: string;
  totalPromises: number;
  survivedCount: number;
  dilutionRate: number;
  coalitionName: string;
  matchingMethod: string;
  note: string;
  disclaimer: string;
}

interface ThemaParadoxEntry {
  partyId: string;
  abbreviation: string;
  theme: string;
  mcs: number;
  promiseDirection: string;
  note: string;
}

interface ElectionAnalysisEntry {
  slug: string;
  name: string;
  winner: { abbreviation: string; seats: number; mcs: number | null } | null;
  correlation: { direction: string; strength: string; note: string } | null;
  topFinding: string | null;
}

interface BelofteVanDeWeekEntry {
  weekNumber: number;
  year: number;
  partyId: string;
  abbreviation: string;
  promiseId: string;
  promiseText: string;
  promiseSummary: string;
  theme: string;
  motionId: string;
  motionTitle: string;
  motionDate: string;
  voteResult: string;
  matchType: string;
  confidence: number;
  status: "nagekomen" | "geschonden" | "gemengd";
  toelichting: string;
  parliamentSlug: string;
  parliamentName: string;
}

@Injectable()
export class InsightsService {
  /**
   * Returns all insights in one response for the frontend.
   */
  async getAllInsights() {
    const [bedgenoten, scheuren, beweging, consensus, beloftehouders, themakloof, rebellen, verwatering, paradox, belofteVanDeWeek, verkiezingsanalyse] =
      await Promise.allSettled([
        this.getOnverwachteBedgenoten(),
        this.getCoalitieScheuren(),
        this.getStijgersDalers(),
        this.getStilleConsensus(),
        this.getBeloftehouders(),
        this.getThemaKloof(),
        this.getTopRebellen(),
        this.getCoalitieVerwatering(),
        this.getThemaParadox(),
        this.getBelofteVanDeWeek(),
        this.getVerkiezingsAnalyse(),
      ]);

    const val = <T>(r: PromiseSettledResult<T[]>) =>
      r.status === "fulfilled" ? r.value : [];
    const valSingle = <T>(r: PromiseSettledResult<T>) =>
      r.status === "fulfilled" ? r.value : null;

    return {
      bedgenoten: val(bedgenoten),
      scheuren: val(scheuren),
      beweging: val(beweging),
      consensus: val(consensus),
      beloftehouders: val(beloftehouders),
      themakloof: val(themakloof),
      rebellen: val(rebellen),
      verwatering: val(verwatering),
      paradox: val(paradox),
      belofteVanDeWeek: valSingle(belofteVanDeWeek),
      verkiezingsanalyse: val(verkiezingsanalyse),
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── 1. Onverwachte Bedgenoten ──────────────────────────────

  async getOnverwachteBedgenoten(): Promise<BedgenotenPair[]> {
    const votes = await prisma.vote.findMany({
      where: {
        result: { in: ["Aangenomen", "Verworpen"] },
      },
      select: {
        id: true,
        motionId: true,
        date: true,
        rawData: true,
        motion: { select: { id: true, title: true, dateIntroduced: true } },
      },
      take: 500,
      orderBy: { date: "desc" },
    });

    const pairStats = new Map<
      string,
      { agree: number; total: number; lastMotion: any }
    >();

    for (const vote of votes) {
      const partyStance = extractPartyStances(vote);

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

    const results: BedgenotenPair[] = [];
    for (const [key, stat] of pairStats) {
      if (stat.total < 10) continue;
      const pct = Math.round((stat.agree / stat.total) * 100);
      if (pct < 50) continue;

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
              date: stat.lastMotion.dateIntroduced
                ? String(stat.lastMotion.dateIntroduced)
                : "",
            }
          : null,
        note: `${partyA} en ${partyB} stemden in ${pct}% van ${stat.total} stemmingen hetzelfde.`,
      });
    }

    return results.sort((a, b) => b.agreementPct - a.agreementPct).slice(0, 8);
  }

  // ─── 2. Coalitie-Scheuren ───────────────────────────────────

  async getCoalitieScheuren(): Promise<CoalitieScheur[]> {
    const votes = await prisma.vote.findMany({
      where: {
        result: { in: ["Aangenomen", "Verworpen"] },
      },
      select: {
        id: true,
        motionId: true,
        date: true,
        rawData: true,
        motion: { select: { id: true, title: true, dateIntroduced: true } },
      },
      take: 500,
      orderBy: { date: "desc" },
    });

    const results: CoalitieScheur[] = [];

    for (const coalition of COALITIONS) {
      for (const vote of votes) {
        const partyStance = extractPartyStances(vote);

        // Check if all coalition parties voted
        const coalitionVotes: { abbreviation: string; vote: string }[] = [];
        for (const party of coalition.parties) {
          const stance = partyStance.get(party);
          if (stance) coalitionVotes.push({ abbreviation: party, vote: stance });
        }

        if (coalitionVotes.length < 3) continue;

        // Check for disagreement
        const forCount = coalitionVotes.filter((v) => v.vote === "FOR").length;
        const againstCount = coalitionVotes.filter((v) => v.vote === "AGAINST").length;

        if (forCount > 0 && againstCount > 0) {
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

    return results
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }

  // ─── 3. Stijgers & Dalers ──────────────────────────────────

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
        rawData: true,
        motion: { select: { id: true, title: true, dateIntroduced: true } },
      },
      take: 500,
      orderBy: { date: "desc" },
    });

    const results: StilleConsensusMotion[] = [];

    for (const vote of votes) {
      const partyStances = extractPartyStances(vote);

      if (partyStances.size < 5) continue;

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

  // ─── 5. Beloftehouders — Best & worst promise-keepers ────

  async getBeloftehouders(): Promise<BeloftehouderEntry[]> {
    const tkParliament = await prisma.parliament.findUnique({ where: { slug: "tweede-kamer" } });
    if (!tkParliament) return [];

    const scorecards = await prisma.precomputedScorecard.findMany({
      where: {
        electionYear: 2025,
        programType: "VERKIEZINGSPROGRAMMA",
        scoredPromises: { gt: 0 },
        party: { parliamentId: tkParliament.id },
      },
      select: {
        partyId: true,
        mcs: true,
        scoredPromises: true,
        party: { select: { abbreviation: true } },
      },
      orderBy: { mcs: "desc" },
    });

    return scorecards.map((sc, i) => ({
      partyId: sc.partyId,
      abbreviation: sc.party.abbreviation,
      mcs: sc.mcs,
      scoredPromises: sc.scoredPromises,
      rank: i + 1,
      note:
        i === 0
          ? `${sc.party.abbreviation} is de betrouwbaarste partij met ${sc.mcs}% MCS.`
          : i === scorecards.length - 1
            ? `${sc.party.abbreviation} scoort het laagst met ${sc.mcs}% MCS.`
            : `${sc.party.abbreviation}: ${sc.mcs}% MCS (#${i + 1}).`,
    }));
  }

  // ─── 6. Thema-kloof — Worst coalition themes ─────────────

  async getThemaKloof(): Promise<ThemaKloofEntry[]> {
    const activeCoalition = COALITIONS.find((c) => !c.endDate);
    if (!activeCoalition) return [];

    const tkParliament = await prisma.parliament.findUnique({ where: { slug: "tweede-kamer" } });
    if (!tkParliament) return [];

    const coalitionParties = await prisma.party.findMany({
      where: { abbreviation: { in: activeCoalition.parties }, parliamentId: tkParliament.id },
      select: { id: true, abbreviation: true },
    });

    const partyIds = coalitionParties.map((p) => p.id);
    const abbrMap = new Map(coalitionParties.map((p) => [p.id, p.abbreviation]));

    const scorecards = await prisma.precomputedScorecard.findMany({
      where: {
        partyId: { in: partyIds },
        electionYear: 2025,
        programType: "VERKIEZINGSPROGRAMMA",
        scoredPromises: { gt: 0 },
      },
      select: { partyId: true, detailJson: true },
    });

    const themeStats = new Map<string, { parties: { abbreviation: string; mcs: number }[] }>();

    for (const sc of scorecards) {
      const detail = sc.detailJson as any;
      if (!detail?.byTheme) continue;

      for (const [theme, data] of Object.entries<any>(detail.byTheme)) {
        const total = (data.consistent ?? 0) + (data.inconsistent ?? 0) + (data.mixed ?? 0);
        if (total === 0) continue;
        const themeMcs = Math.round((data.consistent / total) * 100);

        if (!themeStats.has(theme)) themeStats.set(theme, { parties: [] });
        themeStats.get(theme)!.parties.push({
          abbreviation: abbrMap.get(sc.partyId) ?? "?",
          mcs: themeMcs,
        });
      }
    }

    const results: ThemaKloofEntry[] = [];
    for (const [theme, stats] of themeStats) {
      if (stats.parties.length < 2) continue;
      const avg = Math.round(stats.parties.reduce((s, p) => s + p.mcs, 0) / stats.parties.length);
      results.push({
        theme,
        coalitionName: activeCoalition.name,
        avgMcs: avg,
        parties: stats.parties.sort((a, b) => a.mcs - b.mcs),
        note: `Op ${theme} scoort de ${activeCoalition.name}-coalitie gemiddeld ${avg}%.`,
      });
    }

    return results.sort((a, b) => a.avgMcs - b.avgMcs).slice(0, 8);
  }

  // ─── 7. Top Rebellen — MPs who vote against their party ──

  async getTopRebellen(): Promise<RebelMpEntry[]> {
    const tkParliament = await prisma.parliament.findUnique({ where: { slug: "tweede-kamer" } });
    if (!tkParliament) return [];

    const parties = await prisma.party.findMany({
      where: { parliamentId: tkParliament.id },
      select: { id: true, abbreviation: true },
    });

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const partyIds = parties.map((p) => p.id);
    const abbrMap = new Map(parties.map((p) => [p.id, p.abbreviation]));

    // Fetch vote records for tracked TK parties only
    const records = await prisma.voteRecord.findMany({
      where: {
        voteValue: { in: ["FOR", "AGAINST"] },
        partyIdSnapshot: { in: partyIds },
        vote: { date: { gte: oneYearAgo } },
      },
      select: {
        mpId: true,
        voteId: true,
        voteValue: true,
        partyIdSnapshot: true,
      },
    });

    // Get MP names in a separate batch
    const mpIds = [...new Set(records.map((r) => r.mpId))];
    const mps = await prisma.mp.findMany({
      where: { id: { in: mpIds } },
      select: { id: true, name: true, surname: true, partyId: true },
    });
    const mpMap = new Map(mps.map((m) => [m.id, m]));

    // Group by vote+party to determine party line
    const votePartyLine = new Map<string, Map<string, { for: number; against: number }>>();
    for (const r of records) {
      const key = r.voteId;
      if (!votePartyLine.has(key)) votePartyLine.set(key, new Map());
      const partyMap = votePartyLine.get(key)!;
      if (!partyMap.has(r.partyIdSnapshot)) partyMap.set(r.partyIdSnapshot, { for: 0, against: 0 });
      const counts = partyMap.get(r.partyIdSnapshot)!;
      if (r.voteValue === "FOR") counts.for++;
      else counts.against++;
    }

    // Per-MP deviation
    const mpStats = new Map<string, { total: number; deviations: number }>();
    for (const r of records) {
      const partyMap = votePartyLine.get(r.voteId);
      if (!partyMap) continue;
      const counts = partyMap.get(r.partyIdSnapshot);
      if (!counts) continue;
      const partyMajority = counts.for >= counts.against ? "FOR" : "AGAINST";

      if (!mpStats.has(r.mpId)) mpStats.set(r.mpId, { total: 0, deviations: 0 });
      const stats = mpStats.get(r.mpId)!;
      stats.total++;
      if (r.voteValue !== partyMajority) stats.deviations++;
    }

    const results: RebelMpEntry[] = [];
    for (const [mpId, stats] of mpStats) {
      if (stats.total < 5 || stats.deviations < 1) continue;
      const mp = mpMap.get(mpId);
      if (!mp) continue;
      const pct = Math.round((stats.deviations / stats.total) * 100);
      const abbreviation = mp.partyId ? (abbrMap.get(mp.partyId) ?? "?") : "?";
      const displayName = mp.surname ?? mp.name ?? "?";
      results.push({
        mpId,
        name: mp.name ?? "",
        surname: mp.surname ?? "",
        abbreviation,
        totalVotes: stats.total,
        deviations: stats.deviations,
        deviationPct: pct,
        note: `${displayName} (${abbreviation}) stemde ${stats.deviations}x tegen de eigen fractie.`,
      });
    }

    return results.sort((a, b) => b.deviationPct - a.deviationPct).slice(0, 10);
  }

  // ─── 8. Coalitieverwatering — Promise dilution leaders ───

  async getCoalitieVerwatering(): Promise<VerwateringEntry[]> {
    const activeCoalition = COALITIONS.find((c) => !c.endDate);
    if (!activeCoalition) return [];

    const tkParliament = await prisma.parliament.findUnique({ where: { slug: "tweede-kamer" } });
    if (!tkParliament) return [];

    const coalitionParties = await prisma.party.findMany({
      where: { abbreviation: { in: activeCoalition.parties }, parliamentId: tkParliament.id },
      select: { id: true, abbreviation: true },
    });

    const results: VerwateringEntry[] = [];

    for (const party of coalitionParties) {
      // Get party promises from election year before the coalition
      const partyProgram = await prisma.program.findFirst({
        where: { partyId: party.id, programType: "VERKIEZINGSPROGRAMMA", electionYear: 2025 },
      });
      if (!partyProgram) continue;

      const partyPromises = await prisma.promise.findMany({
        where: { programId: partyProgram.id },
        select: { id: true, summary: true, promiseCode: true, keywords: true },
      });

      // Get regeerakkoord where this party is in coalition
      const regeerakkoord = await prisma.program.findFirst({
        where: {
          programType: "REGEERAKKOORD",
          coalitionPartyIds: { has: party.id },
        },
      });
      if (!regeerakkoord) continue;

      const raPromises = await prisma.promise.findMany({
        where: { programId: regeerakkoord.id },
        select: { summary: true, promiseCode: true, keywords: true },
      });

      // Semantic matching via cosine similarity on sentence embeddings
      let survived = 0;
      let usedSemantic = false;

      try {
        const ppTexts = partyPromises.map((p) => (p as any).summary || `Promise ${(p as any).promiseCode}`);
        const raTexts = raPromises.map((p) => (p as any).summary || `Promise`);

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (apiKey && ppTexts.length > 0 && raTexts.length > 0) {
          const embed = async (texts: string[]) => {
            const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": "https://civicstat.nl",
                "X-Title": "CivicStat API",
              },
              body: JSON.stringify({
                model: "openai/text-embedding-3-small",
                input: texts.map((t) => t.slice(0, 8000)),
                dimensions: 1536,
              }),
            });
            if (!res.ok) throw new Error(`Embedding API ${res.status}`);
            const json = await res.json();
            return (json.data as Array<{ embedding: number[]; index: number }>)
              .sort((a, b) => a.index - b.index)
              .map((d) => d.embedding);
          };

          const cosine = (a: number[], b: number[]) => {
            let dot = 0, nA = 0, nB = 0;
            for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
            const d = Math.sqrt(nA) * Math.sqrt(nB);
            return d === 0 ? 0 : dot / d;
          };

          const [ppEmb, raEmb] = await Promise.all([embed(ppTexts), embed(raTexts)]);

          for (let i = 0; i < ppEmb.length; i++) {
            let maxSim = 0;
            for (let j = 0; j < raEmb.length; j++) {
              const sim = cosine(ppEmb[i], raEmb[j]);
              if (sim > maxSim) maxSim = sim;
            }
            if (maxSim >= 0.55) survived++;
          }
          usedSemantic = true;
        }
      } catch {
        // Fallback to keyword overlap
        usedSemantic = false;
      }

      if (!usedSemantic) {
        survived = 0;
        for (const pp of partyPromises) {
          const ppKw = new Set(((pp.keywords as string[]) || []).map((k) => k.toLowerCase()));
          let matched = false;
          for (const rp of raPromises) {
            const shared = ((rp.keywords as string[]) || []).filter((k) => ppKw.has(k.toLowerCase()));
            if (shared.length >= 3) { matched = true; break; }
          }
          if (matched) survived++;
        }
      }

      const total = partyPromises.length;
      if (total === 0) continue;
      const dilutionRate = Math.round(((total - survived) / total) * 100);

      results.push({
        partyId: party.id,
        abbreviation: party.abbreviation,
        totalPromises: total,
        survivedCount: survived,
        dilutionRate,
        coalitionName: activeCoalition.name,
        matchingMethod: usedSemantic ? "semantic_cosine_similarity" : "keyword_overlap_fallback",
        note: `${party.abbreviation} leverde ${dilutionRate}% van haar beloften in bij de ${activeCoalition.name}-coalitie.`,
        disclaimer: "Meet tekstuele overlap tussen verkiezingsbeloften en regeerakkoord, niet beleidsinhoudelijke overeenkomst.",
      });
    }

    return results.sort((a, b) => b.dilutionRate - a.dilutionRate);
  }

  // ─── 9. Thema-paradox — Voting against stated positions ──

  async getThemaParadox(): Promise<ThemaParadoxEntry[]> {
    const tkParliament = await prisma.parliament.findUnique({ where: { slug: "tweede-kamer" } });
    if (!tkParliament) return [];

    const scorecards = await prisma.precomputedScorecard.findMany({
      where: {
        electionYear: 2025,
        programType: "VERKIEZINGSPROGRAMMA",
        scoredPromises: { gt: 0 },
        party: { parliamentId: tkParliament.id },
      },
      select: {
        partyId: true,
        detailJson: true,
        party: { select: { abbreviation: true } },
      },
    });

    const results: ThemaParadoxEntry[] = [];

    for (const sc of scorecards) {
      const detail = sc.detailJson as any;
      if (!detail?.byTheme) continue;

      for (const [theme, data] of Object.entries<any>(detail.byTheme)) {
        const total = (data.consistent ?? 0) + (data.inconsistent ?? 0) + (data.mixed ?? 0);
        if (total < 3) continue;
        const themeMcs = Math.round((data.consistent / total) * 100);

        // Flag themes where a party scores very low (votes opposite to promises)
        if (themeMcs <= 30) {
          results.push({
            partyId: sc.partyId,
            abbreviation: sc.party.abbreviation,
            theme,
            mcs: themeMcs,
            promiseDirection: "tegen eigen beloften",
            note: `${sc.party.abbreviation} stemde in ${100 - themeMcs}% van de gevallen tegen hun eigen ${theme}-beloften.`,
          });
        }
      }
    }

    return results.sort((a, b) => a.mcs - b.mcs).slice(0, 10);
  }

  // ─── 10. Verkiezingsanalyse 2026 — Election analysis ──────

  async getVerkiezingsAnalyse(): Promise<ElectionAnalysisEntry[]> {
    const municipalities = await prisma.parliament.findMany({
      where: { level: "MUNICIPAL", active: true },
      select: { id: true, slug: true, name: true, shortName: true },
      orderBy: { name: "asc" },
    });

    const results: ElectionAnalysisEntry[] = [];

    for (const muni of municipalities) {
      const parties = await prisma.party.findMany({
        where: { parliamentId: muni.id },
        select: { id: true, abbreviation: true, seats: true },
        orderBy: { seats: "desc" },
      });

      const partyIds = parties.map((p) => p.id);
      const totalSeats = parties.reduce((sum, p) => sum + (p.seats ?? 0), 0);

      // Get MCS scorecards (prefer 2022 historical, fallback 2026)
      const [scs2022, scs2026] = await Promise.all([
        prisma.precomputedScorecard.findMany({
          where: { partyId: { in: partyIds }, electionYear: 2022, programType: "VERKIEZINGSPROGRAMMA" },
          select: { partyId: true, mcs: true },
        }),
        prisma.precomputedScorecard.findMany({
          where: { partyId: { in: partyIds }, electionYear: 2026, programType: "VERKIEZINGSPROGRAMMA" },
          select: { partyId: true, mcs: true },
        }),
      ]);

      const mcsMap2022 = new Map(scs2022.map((s) => [s.partyId, s.mcs]));
      const mcsMap2026 = new Map(scs2026.map((s) => [s.partyId, s.mcs]));

      // Build party data with MCS + seats
      const partyData = parties
        .filter((p) => (p.seats ?? 0) > 0)
        .map((p) => ({
          abbreviation: p.abbreviation,
          seats: p.seats ?? 0,
          seatShare: totalSeats > 0 ? (p.seats ?? 0) / totalSeats : 0,
          mcs: mcsMap2022.get(p.id) ?? mcsMap2026.get(p.id) ?? null,
        }))
        .filter((p) => p.mcs != null);

      // Winner — party with most seats (filter to those with seats > 0)
      const partiesWithSeats = parties.filter((p) => (p.seats ?? 0) > 0);
      const winnerParty = partiesWithSeats.sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0))[0] ?? null;
      const winner = winnerParty
        ? {
            abbreviation: winnerParty.abbreviation,
            seats: winnerParty.seats ?? 0,
            mcs: mcsMap2022.get(winnerParty.id) ?? mcsMap2026.get(winnerParty.id) ?? null,
          }
        : null;

      // Rank correlation (Spearman) between MCS and seat share
      let correlation: ElectionAnalysisEntry["correlation"] = null;
      let topFinding: string | null = null;

      if (partyData.length >= 3) {
        const byMcs = [...partyData].sort((a, b) => b.mcs! - a.mcs!);
        const mcsRanks = new Map(byMcs.map((p, i) => [p.abbreviation, i + 1]));
        const bySeats = [...partyData].sort((a, b) => b.seatShare - a.seatShare);
        const seatRanks = new Map(bySeats.map((p, i) => [p.abbreviation, i + 1]));

        const n = partyData.length;
        let sumD2 = 0;
        for (const p of partyData) {
          const d = (mcsRanks.get(p.abbreviation) ?? 0) - (seatRanks.get(p.abbreviation) ?? 0);
          sumD2 += d * d;
        }
        const rho = 1 - (6 * sumD2) / (n * (n * n - 1));

        const direction = rho > 0.3 ? "positive" : rho < -0.3 ? "negative" : "neutral";
        const strength = Math.abs(rho) > 0.6 ? "sterk" : Math.abs(rho) > 0.3 ? "matig" : "zwak";

        correlation = {
          direction,
          strength,
          note: direction === "positive"
            ? `Kiezers in ${muni.shortName ?? muni.name} beloonden betrouwbare partijen: ${strength} positief verband.`
            : direction === "negative"
              ? `In ${muni.shortName ?? muni.name} wonnen minder betrouwbare partijen juist meer zetels.`
              : `Geen duidelijk verband tussen MCS en zetels in ${muni.shortName ?? muni.name}.`,
        };

        // Top finding: winner's MCS vs average
        if (winner?.mcs != null) {
          const avgMcs = Math.round(partyData.reduce((s, p) => s + p.mcs!, 0) / partyData.length);
          topFinding = winner.mcs >= avgMcs
            ? `Winnaar ${winner.abbreviation} had bovengemiddelde MCS (${winner.mcs}% vs. gem. ${avgMcs}%).`
            : `Winnaar ${winner.abbreviation} had ondergemiddelde MCS (${winner.mcs}% vs. gem. ${avgMcs}%).`;
        }
      }

      results.push({
        slug: muni.slug,
        name: muni.shortName ?? muni.name,
        winner,
        correlation,
        topFinding,
      });
    }

    return results;
  }

  // ─── 11. Belofte van de Week ────────────────────────────────

  async getBelofteVanDeWeek(): Promise<BelofteVanDeWeekEntry | null> {
    // Look back up to 90 days to find the most newsworthy promise-vote finding
    const lookbackDays = 90;
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Get ISO week number for labeling
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    );

    // Find recent votes that have promise-motion matches AND party-level data
    const recentVotes = await prisma.vote.findMany({
      where: {
        date: { gte: since },
        result: { in: ["Aangenomen", "Verworpen"] },
        motionId: { not: null },
        motion: { parliament: { country: "NL" } },
        OR: [
          { records: { some: {} } },
          { rawData: { path: ["StemmingsSoort"], equals: "Hoofdelijk" } },
        ],
      },
      select: {
        id: true,
        motionId: true,
        date: true,
        result: true,
        rawData: true,
        motion: {
          select: {
            id: true,
            title: true,
            dateIntroduced: true,
            soort: true,
            parliamentId: true,
            parliament: { select: { slug: true, name: true } },
            promiseMatches: {
              where: {
                confidence: { gte: 0.5 },
                matchType: { in: ["EXPLICIT_MATCH", "IMPLICIT_MATCH", "CONTRADICTS"] },
              },
              select: {
                id: true,
                matchType: true,
                confidence: true,
                rationale: true,
                predictedDirection: true,
                promise: {
                  select: {
                    id: true,
                    text: true,
                    summary: true,
                    theme: true,
                    expectedVoteDirection: true,
                    program: {
                      select: {
                        party: { select: { id: true, abbreviation: true } },
                      },
                    },
                  },
                },
              },
              orderBy: { confidence: "desc" },
              take: 5,
            },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    // Build party stance lookup from VoteRecords as fallback
    const voteIds = recentVotes.map((v) => v.id);
    const voteRecords = await prisma.voteRecord.findMany({
      where: { voteId: { in: voteIds }, voteValue: { in: ["FOR", "AGAINST"] } },
      select: { voteId: true, voteValue: true, partyIdSnapshot: true },
    });

    // Group: voteId -> partyId -> majority vote
    const votePartyTally = new Map<string, Map<string, { for: number; against: number }>>();
    for (const r of voteRecords) {
      if (!votePartyTally.has(r.voteId)) votePartyTally.set(r.voteId, new Map());
      const partyMap = votePartyTally.get(r.voteId)!;
      if (!partyMap.has(r.partyIdSnapshot)) partyMap.set(r.partyIdSnapshot, { for: 0, against: 0 });
      const c = partyMap.get(r.partyIdSnapshot)!;
      if (r.voteValue === "FOR") c.for++;
      else c.against++;
    }

    // Build partyId -> abbreviation map
    const allPartyIds = new Set<string>();
    for (const v of recentVotes) {
      for (const m of v.motion?.promiseMatches ?? []) {
        allPartyIds.add(m.promise.program.party.id);
      }
    }
    const partyList = await prisma.party.findMany({
      where: { id: { in: [...allPartyIds] } },
      select: { id: true, abbreviation: true },
    });
    const partyIdToAbbr = new Map(partyList.map((p) => [p.id, p.abbreviation]));

    // Score each candidate by newsworthiness
    interface Candidate {
      score: number;
      vote: (typeof recentVotes)[0];
      match: NonNullable<(typeof recentVotes)[0]["motion"]>["promiseMatches"][0];
      status: "nagekomen" | "geschonden" | "gemengd";
    }

    const candidates: Candidate[] = [];

    for (const vote of recentVotes) {
      if (!vote.motion?.promiseMatches?.length) continue;

      // Try rawData first, then VoteRecord fallback
      const rawStances = extractPartyStances(vote);

      for (const match of vote.motion.promiseMatches) {
        const party = match.promise.program.party;

        // Determine party vote: try rawData stances first, then VoteRecord tally
        let partyVote = rawStances.get(party.abbreviation);
        if (!partyVote) {
          const tally = votePartyTally.get(vote.id)?.get(party.id);
          if (tally) {
            partyVote = tally.for >= tally.against ? "FOR" : "AGAINST";
          }
        }
        if (!partyVote) continue;

        const expectedRaw = match.promise.expectedVoteDirection;
        if (!expectedRaw) continue;

        // Normalize Dutch/English vote direction
        const expected = expectedRaw.toUpperCase() === "VOOR" || expectedRaw.toUpperCase() === "FOR" ? "FOR" : "AGAINST";

        // Determine if the party kept or broke the promise
        let status: "nagekomen" | "geschonden" | "gemengd";
        if (match.matchType === "CONTRADICTS") {
          // For contradicting motions, voting AGAINST aligns with the promise
          status = partyVote === "AGAINST" ? "nagekomen" : "geschonden";
        } else {
          // For supporting motions, voting with expectedVoteDirection = kept
          status = partyVote === expected ? "nagekomen" : "geschonden";
        }

        // Score: higher confidence + explicit match + broken promises are more newsworthy
        let score = match.confidence * 10;
        if (match.matchType === "EXPLICIT_MATCH") score *= 2;
        if (status === "geschonden") score *= 1.5; // broken promises are more newsworthy
        if (vote.motion.soort?.toLowerCase().includes("wetsvoorstel")) score *= 1.3;
        // Recency bonus: more recent = higher score (up to 2x for today, 1x for 90d ago)
        const ageMs = Date.now() - (vote.date?.getTime() ?? 0);
        const ageDays = ageMs / (24 * 60 * 60 * 1000);
        score *= 1 + Math.max(0, 1 - ageDays / lookbackDays);

        candidates.push({ score, vote, match, status });
      }
    }

    if (candidates.length === 0) {
      // Fallback: no recent findings, return null (serializes as empty 200)
      return null;
    }

    // Pick the best candidate
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const party = best.match.promise.program.party;
    const parliament = best.vote.motion!.parliament;

    // Generate neutral Dutch explanation
    const statusNl = best.status === "nagekomen" ? "nagekomen" : best.status === "geschonden" ? "geschonden" : "gemengd";
    const actionNl = best.status === "nagekomen"
      ? `stemde in lijn met deze belofte`
      : `stemde tegen deze belofte`;

    const toelichting = `${party.abbreviation} beloofde: "${best.match.promise.summary}". ` +
      `Bij de stemming over "${best.vote.motion!.title}" ${actionNl}. ` +
      `De motie werd ${best.vote.result?.toLowerCase() ?? "behandeld"}.`;

    return {
      weekNumber,
      year: now.getFullYear(),
      partyId: party.id,
      abbreviation: party.abbreviation,
      promiseId: best.match.promise.id,
      promiseText: best.match.promise.text,
      promiseSummary: best.match.promise.summary,
      theme: best.match.promise.theme,
      motionId: best.vote.motion!.id,
      motionTitle: best.vote.motion!.title,
      motionDate: best.vote.motion!.dateIntroduced
        ? new Date(best.vote.motion!.dateIntroduced).toISOString().split("T")[0]
        : best.vote.date?.toISOString().split("T")[0] ?? "",
      voteResult: best.vote.result ?? "",
      matchType: best.match.matchType,
      confidence: best.match.confidence,
      status: statusNl,
      toelichting,
      parliamentSlug: parliament?.slug ?? "tweede-kamer",
      parliamentName: parliament?.name ?? "Tweede Kamer",
    };
  }
}
