import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── B2: Match type weights ────────────────────────────────
const MATCH_TYPE_WEIGHTS: Record<string, number> = {
  EXPLICIT_MATCH: 1.0,
  IMPLICIT_MATCH: 0.5,
  CONTRADICTS: 1.0,
};

// ─── B3: Minimum threshold ─────────────────────────────────
const MIN_MOTIONS_THRESHOLD = 3;

// ─── Period date boundaries ─────────────────────────────────
// Default = full voting history. The question is "given your promises,
// how have you actually been voting?" — past behavior is just as meaningful.
// Users can pass ?periodStart=2025-10-29 for era-specific scoring.
const PERIOD_DEFAULTS: Record<number, { start: string; end: string }> = {
  2023: { start: "2023-11-22", end: "2099-12-31" }, // From TK2023 election day — full history
  2025: { start: "2023-11-22", end: "2099-12-31" }, // Same — full history is meaningful
};

export interface ScorecardOptions {
  electionYear?: number;
  periodStart?: string; // ISO date
  periodEnd?: string;   // ISO date
}

export interface PromiseScore {
  promiseId: string;
  promiseCode: string;
  summary: string;
  theme: string;
  expectedDirection: string;
  totalMotionsWithVotes: number;
  alignedVotes: number;
  opposedVotes: number;
  weightedAligned: number;
  weightedOpposed: number;
  noVoteData: number;
  status: "consistent" | "inconsistent" | "mixed" | "insufficient_data";
}

export interface PartyScorecard {
  partyId: string;
  abbreviation: string;
  electionYear: number;
  periodStart: string;
  periodEnd: string;
  totalPromises: number;
  scoredPromises: number;
  insufficientDataPromises: number;
  consistentCount: number;
  inconsistentCount: number;
  mixedCount: number;
  mandateConsistencyScore: number;
  matchingAlgorithm: string;
  note?: string;
  byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number; insufficientData: number }>;
  promises: PromiseScore[];
}

export interface ScorecardComparison {
  partyId: string;
  abbreviation: string;
  periods: {
    electionYear: number;
    periodStart: string;
    periodEnd: string;
    mandateConsistencyScore: number;
    totalPromises: number;
    scoredPromises: number;
    consistentCount: number;
    inconsistentCount: number;
    mixedCount: number;
  }[];
  koersvastheid: number | null; // How stable is the party across periods
}

@Injectable()
export class PartiesScorecardService {
  private readonly logger = new Logger(PartiesScorecardService.name);

  // ─── P2.1 + P2.2: Period-aware scorecard ─────────────────
  async getScorecard(
    partyIdOrAbbr: string,
    options: ScorecardOptions = {},
  ): Promise<PartyScorecard> {
    const electionYear = options.electionYear ?? 2023;
    const periodDefaults = PERIOD_DEFAULTS[electionYear] ?? PERIOD_DEFAULTS[2023];
    const periodStart = options.periodStart ?? periodDefaults.start;
    const periodEnd = options.periodEnd ?? periodDefaults.end;

    // 1. Find the party
    const party = await this.findParty(partyIdOrAbbr);

    // Try pre-computed scorecard first (only when using default period boundaries)
    const isDefaultPeriod = periodStart === periodDefaults.start && periodEnd === periodDefaults.end;
    if (isDefaultPeriod) {
      const cached = await prisma.precomputedScorecard.findUnique({
        where: {
          partyId_electionYear_programType: {
            partyId: party.id,
            electionYear,
            programType: "VERKIEZINGSPROGRAMMA",
          },
        },
      });

      if (cached) {
        const detail = cached.detailJson as any;
        return { ...detail, mandateConsistencyScore: cached.mcs } as PartyScorecard;
      }

      this.logger.warn(`No pre-computed scorecard for ${party.abbreviation}/${electionYear}, computing on the fly`);
    }

    // Fall back to on-the-fly computation
    // 2. Get all promises for this party's program in the given year
    const promises = await prisma.promise.findMany({
      where: {
        program: { partyId: party.id, electionYear },
      },
      include: {
        motionMatches: {
          include: {
            motion: {
              include: {
                votes: {
                  take: 1,
                  where: {
                    // P2.2: Filter votes within the parliamentary period
                    date: {
                      gte: new Date(periodStart),
                      lte: new Date(periodEnd),
                    },
                  },
                  include: {
                    records: {
                      where: { partyIdSnapshot: party.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 3. Score each promise
    const scoredPromises: PromiseScore[] = [];
    let consistentCount = 0;
    let inconsistentCount = 0;
    let mixedCount = 0;
    let insufficientDataCount = 0;
    const byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number; insufficientData: number }> = {};

    for (const promise of promises) {
      const expectedDir = promise.expectedVoteDirection;
      if (!expectedDir) continue;

      let aligned = 0;
      let opposed = 0;
      let weightedAligned = 0;
      let weightedOpposed = 0;
      let noData = 0;

      for (const match of promise.motionMatches) {
        // Skip weak matches (confidence < 30%)
        if (match.confidence < 0.3) continue;

        // B2: Confidence-weighted scoring
        const matchTypeWeight = MATCH_TYPE_WEIGHTS[match.matchType] ?? 0.5;
        const effectiveWeight = matchTypeWeight * match.confidence;

        const vote = match.motion.votes?.[0];
        if (!vote) { noData++; continue; }

        // Check party-level vote from individual records
        const partyRecords = vote.records || [];
        let votedFor: boolean | null = null;

        if (partyRecords.length === 0) {
          // Fall back to raw stemming data (party-level "met handopsteken" votes)
          const rawStemmingen = (vote as any).rawData?.Stemming || [];
          const partyNames = [party.abbreviation, party.name].filter(Boolean);
          const partyVote = rawStemmingen.find(
            (s: any) => partyNames.some(n => s.ActorNaam === n)
          );
          if (!partyVote) { noData++; continue; }
          votedFor = partyVote.Soort?.toLowerCase() === "voor";
        } else {
          const forCount = partyRecords.filter((r: any) => r.voteValue === "FOR").length;
          const againstCount = partyRecords.filter((r: any) => r.voteValue === "AGAINST").length;
          votedFor = forCount > againstCount;
        }

        const expectedFor = expectedDir === "VOOR";
        if (votedFor === expectedFor) {
          aligned++;
          weightedAligned += effectiveWeight;
        } else {
          opposed++;
          weightedOpposed += effectiveWeight;
        }
      }

      const totalWithVotes = aligned + opposed;
      const totalWeighted = weightedAligned + weightedOpposed;

      // B3: Minimum threshold — need ≥3 scored motions
      let status: PromiseScore["status"] = "insufficient_data";
      if (totalWithVotes >= MIN_MOTIONS_THRESHOLD && totalWeighted > 0) {
        const ratio = weightedAligned / totalWeighted;
        if (ratio >= 0.70) status = "consistent";
        else if (ratio <= 0.30) status = "inconsistent";
        else status = "mixed";
      }

      // Track by theme
      if (!byTheme[promise.theme]) {
        byTheme[promise.theme] = { consistent: 0, inconsistent: 0, mixed: 0, total: 0, insufficientData: 0 };
      }
      if (status !== "insufficient_data") {
        byTheme[promise.theme].total++;
        byTheme[promise.theme][status]++;
      } else {
        byTheme[promise.theme].insufficientData++;
      }

      if (status === "consistent") consistentCount++;
      else if (status === "inconsistent") inconsistentCount++;
      else if (status === "mixed") mixedCount++;
      else insufficientDataCount++;

      scoredPromises.push({
        promiseId: promise.id,
        promiseCode: promise.promiseCode,
        summary: promise.summary,
        theme: promise.theme,
        expectedDirection: expectedDir,
        totalMotionsWithVotes: totalWithVotes,
        alignedVotes: aligned,
        opposedVotes: opposed,
        weightedAligned: Math.round(weightedAligned * 100) / 100,
        weightedOpposed: Math.round(weightedOpposed * 100) / 100,
        noVoteData: noData,
        status,
      });
    }

    // B4: Sample-size weighted aggregate MCS
    const scored = scoredPromises.filter(p => p.status !== "insufficient_data");
    let weightedConsistencySum = 0;
    let totalMotionWeight = 0;

    for (const p of scored) {
      const weight = p.totalMotionsWithVotes;
      const totalW = p.weightedAligned + p.weightedOpposed;
      const ratio = totalW > 0 ? p.weightedAligned / totalW : 0;
      weightedConsistencySum += ratio * weight;
      totalMotionWeight += weight;
    }

    const mandateConsistencyScore = totalMotionWeight > 0
      ? Math.round((weightedConsistencySum / totalMotionWeight) * 100)
      : 0;

    return {
      partyId: party.id,
      abbreviation: party.abbreviation,
      electionYear,
      periodStart,
      periodEnd,
      totalPromises: promises.length,
      scoredPromises: scored.length,
      insufficientDataPromises: insufficientDataCount,
      consistentCount,
      inconsistentCount,
      mixedCount,
      mandateConsistencyScore,
      matchingAlgorithm: "keyword-overlap-v2",
      note: scored.length < promises.length
        ? `${insufficientDataCount} belofte(n) hebben onvoldoende data (< ${MIN_MOTIONS_THRESHOLD} moties)`
        : undefined,
      byTheme,
      promises: scoredPromises,
    };
  }

  // ─── P2.1: All scorecards (with optional year) ───────────
  async getAllScorecards(
    options: ScorecardOptions = {},
  ): Promise<Omit<PartyScorecard, "promises">[]> {
    const electionYear = options.electionYear ?? 2023;
    const periodDefaults = PERIOD_DEFAULTS[electionYear] ?? PERIOD_DEFAULTS[2023];
    const isDefaultPeriod = !options.periodStart && !options.periodEnd;

    // Try pre-computed scorecards first
    if (isDefaultPeriod) {
      const precomputed = await prisma.precomputedScorecard.findMany({
        where: {
          electionYear,
          programType: "VERKIEZINGSPROGRAMMA",
        },
      });

      if (precomputed.length > 0) {
        return precomputed
          .map((row) => {
            const detail = row.detailJson as any;
            const { promises, ...summary } = detail;
            return {
              ...summary,
              mandateConsistencyScore: row.mcs,
            } as Omit<PartyScorecard, "promises">;
          })
          .sort((a, b) => b.mandateConsistencyScore - a.mandateConsistencyScore);
      }

      this.logger.warn(`No pre-computed scorecards for year ${electionYear}, computing on the fly`);
    }

    // Fall back to on-the-fly computation
    const partiesWithPromises = await prisma.$queryRaw<{ party_id: string }[]>`
      SELECT DISTINCT prog.party_id
      FROM promises p
      JOIN programs prog ON p.program_id = prog.id
      WHERE prog.election_year = ${electionYear}
    `;

    const scorecards = [];
    for (const { party_id } of partiesWithPromises) {
      try {
        const full = await this.getScorecard(party_id, options);
        const { promises, ...summary } = full;
        scorecards.push(summary);
      } catch (err) {
        console.error(`Scorecard failed for ${party_id}:`, err);
      }
    }

    return scorecards.sort((a, b) => b.mandateConsistencyScore - a.mandateConsistencyScore);
  }

  // ─── P2.3: Compare scorecards across election years ──────
  async compareScorecards(
    years: number[] = [2023, 2025],
    options: { periodStart?: string; periodEnd?: string } = {},
  ): Promise<ScorecardComparison[]> {
    const isDefaultPeriod = !options.periodStart && !options.periodEnd;

    // Try pre-computed scorecards first (single DB query instead of 30 scorecard computations)
    if (isDefaultPeriod) {
      const precomputed = await prisma.precomputedScorecard.findMany({
        where: {
          electionYear: { in: years },
          programType: "VERKIEZINGSPROGRAMMA",
        },
        include: {
          party: { select: { id: true, abbreviation: true } },
        },
      });

      if (precomputed.length > 0) {
        // Group by party
        const byParty = new Map<string, typeof precomputed>();
        for (const row of precomputed) {
          if (!byParty.has(row.partyId)) byParty.set(row.partyId, []);
          byParty.get(row.partyId)!.push(row);
        }

        const comparisons: ScorecardComparison[] = [];
        for (const [partyId, rows] of byParty) {
          const party = rows[0].party;
          const periods = rows.map((row) => {
            const detail = row.detailJson as any;
            return {
              electionYear: row.electionYear,
              periodStart: detail.periodStart,
              periodEnd: detail.periodEnd,
              mandateConsistencyScore: row.mcs,
              totalPromises: row.totalPromises,
              scoredPromises: row.scoredPromises,
              consistentCount: row.consistentCount,
              inconsistentCount: row.inconsistentCount,
              mixedCount: row.mixedCount,
            };
          });

          let koersvastheid: number | null = null;
          if (periods.length >= 2) {
            const scores = periods.map(p => p.mandateConsistencyScore);
            if (scores.every(s => s > 0)) {
              const maxDiff = Math.max(...scores) - Math.min(...scores);
              koersvastheid = Math.round(100 - maxDiff);
            }
          }

          comparisons.push({
            partyId,
            abbreviation: party.abbreviation,
            periods,
            koersvastheid,
          });
        }

        return comparisons.sort((a, b) => {
          if (a.koersvastheid !== null && b.koersvastheid !== null) return b.koersvastheid - a.koersvastheid;
          if (a.koersvastheid !== null) return -1;
          if (b.koersvastheid !== null) return 1;
          return a.abbreviation.localeCompare(b.abbreviation);
        });
      }

      this.logger.warn("No pre-computed scorecards found, falling back to on-the-fly computation");
    }

    // Fall back to on-the-fly computation
    const partyRows = await prisma.$queryRaw<{ party_id: string; election_year: number }[]>`
      SELECT DISTINCT prog.party_id, prog.election_year
      FROM promises p
      JOIN programs prog ON p.program_id = prog.id
      WHERE prog.election_year = ANY(${years})
        AND prog.program_type = 'VERKIEZINGSPROGRAMMA'
    `;

    const allPartyIds = [...new Set(partyRows.map(r => r.party_id))];
    const parties = await prisma.party.findMany({
      where: { id: { in: allPartyIds } },
      select: { id: true, abbreviation: true },
    });
    const partyMap = new Map(parties.map(p => [p.id, p]));

    const scorecardJobs = allPartyIds.flatMap(partyId =>
      years.map(year => ({ partyId, year }))
    );

    const BATCH_SIZE = 6;
    const results: { partyId: string; year: number; scorecard: any }[] = [];
    for (let i = 0; i < scorecardJobs.length; i += BATCH_SIZE) {
      const batch = scorecardJobs.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ partyId, year }) => {
          const scorecard = await this.getScorecard(partyId, {
            electionYear: year,
            periodStart: options.periodStart,
            periodEnd: options.periodEnd,
          });
          return { partyId, year, scorecard };
        })
      );
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        }
      }
    }

    const byParty = new Map<string, { year: number; scorecard: any }[]>();
    for (const { partyId, year, scorecard } of results) {
      if (!scorecard) continue;
      if (!byParty.has(partyId)) byParty.set(partyId, []);
      byParty.get(partyId)!.push({ year, scorecard });
    }

    const comparisons: ScorecardComparison[] = [];
    for (const [partyId, periodResults] of byParty) {
      const party = partyMap.get(partyId);
      if (!party || periodResults.length === 0) continue;

      const periods = periodResults.map(({ year, scorecard: sc }) => ({
        electionYear: year,
        periodStart: sc.periodStart,
        periodEnd: sc.periodEnd,
        mandateConsistencyScore: sc.mandateConsistencyScore,
        totalPromises: sc.totalPromises,
        scoredPromises: sc.scoredPromises,
        consistentCount: sc.consistentCount,
        inconsistentCount: sc.inconsistentCount,
        mixedCount: sc.mixedCount,
      }));

      let koersvastheid: number | null = null;
      if (periods.length >= 2) {
        const scores = periods.map(p => p.mandateConsistencyScore);
        if (scores.every(s => s > 0)) {
          const maxDiff = Math.max(...scores) - Math.min(...scores);
          koersvastheid = Math.round(100 - maxDiff);
        }
      }

      comparisons.push({ partyId, abbreviation: party.abbreviation, periods, koersvastheid });
    }

    return comparisons.sort((a, b) => {
      if (a.koersvastheid !== null && b.koersvastheid !== null) return b.koersvastheid - a.koersvastheid;
      if (a.koersvastheid !== null) return -1;
      if (b.koersvastheid !== null) return 1;
      return a.abbreviation.localeCompare(b.abbreviation);
    });
  }

  // ─── P2.4: Koersvastheid for a single party ─────────────
  async getKoersvastheid(
    partyIdOrAbbr: string,
    years: number[] = [2023, 2025],
  ): Promise<{
    partyId: string;
    abbreviation: string;
    koersvastheid: number | null;
    periods: {
      electionYear: number;
      mandateConsistencyScore: number;
      scoredPromises: number;
      byTheme: Record<string, { score2023?: number; score2025?: number; delta: number }>;
    }[];
    themeStability: Record<string, number>; // Per-theme koersvastheid
  }> {
    const party = await this.findParty(partyIdOrAbbr);
    const periods = [];
    const themeScores: Record<string, Record<number, number>> = {};

    for (const year of years) {
      try {
        const scorecard = await this.getScorecard(party.id, { electionYear: year });
        periods.push({
          electionYear: year,
          mandateConsistencyScore: scorecard.mandateConsistencyScore,
          scoredPromises: scorecard.scoredPromises,
          byTheme: scorecard.byTheme,
        });

        // Collect per-theme MCS for stability analysis
        for (const [theme, data] of Object.entries(scorecard.byTheme)) {
          if (!themeScores[theme]) themeScores[theme] = {};
          const total = data.total;
          if (total > 0) {
            themeScores[theme][year] = Math.round((data.consistent / total) * 100);
          }
        }
      } catch {
        // Party may not have promises for this year
      }
    }

    // Overall koersvastheid
    let koersvastheid: number | null = null;
    if (periods.length >= 2) {
      const scores = periods.map(p => p.mandateConsistencyScore);
      if (scores.every(s => s > 0)) {
        koersvastheid = Math.round(100 - Math.abs(scores[0] - scores[1]));
      }
    }

    // Per-theme stability
    const themeStability: Record<string, number> = {};
    for (const [theme, yearScores] of Object.entries(themeScores)) {
      const vals = Object.values(yearScores);
      if (vals.length >= 2) {
        const maxDiff = Math.max(...vals) - Math.min(...vals);
        themeStability[theme] = Math.round(100 - maxDiff);
      }
    }

    // Build byTheme comparison
    const byThemeComparison: Record<string, { score2023?: number; score2025?: number; delta: number }> = {};
    for (const [theme, yearScores] of Object.entries(themeScores)) {
      byThemeComparison[theme] = {
        score2023: yearScores[2023],
        score2025: yearScores[2025],
        delta: (yearScores[2025] ?? 0) - (yearScores[2023] ?? 0),
      };
    }

    return {
      partyId: party.id,
      abbreviation: party.abbreviation,
      koersvastheid,
      periods: periods.map(p => ({
        electionYear: p.electionYear,
        mandateConsistencyScore: p.mandateConsistencyScore,
        scoredPromises: p.scoredPromises,
        byTheme: byThemeComparison,
      })),
      themeStability,
    };
  }

  // ─── G1: Regeerakkoord scorecard ─────────────────────────
  async getRegeerakkoordScorecard(
    partyIdOrAbbr: string,
    options: ScorecardOptions = {},
  ): Promise<PartyScorecard> {
    const electionYear = options.electionYear ?? 2024;

    // Regeerakkoord period defaults
    const REGEERAKKOORD_PERIODS: Record<number, { start: string; end: string }> = {
      2024: { start: "2024-07-02", end: "2025-10-29" },   // Schoof-I kabinetsperiode
      2026: { start: "2026-02-23", end: "2099-12-31" },   // Jetten kabinetsperiode (ongoing)
    };

    const periodDefaults = REGEERAKKOORD_PERIODS[electionYear] ?? { start: "2024-01-01", end: "2099-12-31" };
    const periodStart = options.periodStart ?? periodDefaults.start;
    const periodEnd = options.periodEnd ?? periodDefaults.end;

    // 1. Find the party
    const party = await this.findParty(partyIdOrAbbr);

    // 2. Find regeerakkoord program where this party is in the coalition
    const program = await prisma.program.findFirst({
      where: {
        programType: "REGEERAKKOORD",
        electionYear,
        coalitionPartyIds: { has: party.id },
      },
    });

    if (!program) {
      throw new NotFoundException(
        `Geen regeerakkoord gevonden voor ${party.abbreviation} in ${electionYear}`
      );
    }

    // 3. Get all promises for this program
    const promises = await prisma.promise.findMany({
      where: { programId: program.id },
      include: {
        motionMatches: {
          include: {
            motion: {
              include: {
                votes: {
                  take: 1,
                  where: {
                    date: {
                      gte: new Date(periodStart),
                      lte: new Date(periodEnd),
                    },
                  },
                  include: {
                    records: {
                      where: { partyIdSnapshot: party.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 4. Score each promise (same logic as getScorecard)
    const scoredPromises: PromiseScore[] = [];
    let consistentCount = 0;
    let inconsistentCount = 0;
    let mixedCount = 0;
    let insufficientDataCount = 0;
    const byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number; insufficientData: number }> = {};

    for (const promise of promises) {
      const expectedDir = promise.expectedVoteDirection || "VOOR";

      let aligned = 0;
      let opposed = 0;
      let weightedAligned = 0;
      let weightedOpposed = 0;
      let noData = 0;

      for (const match of promise.motionMatches) {
        if (match.confidence < 0.3) continue;

        const matchTypeWeight = MATCH_TYPE_WEIGHTS[match.matchType] ?? 0.5;
        const effectiveWeight = matchTypeWeight * match.confidence;

        const vote = match.motion.votes?.[0];
        if (!vote) { noData++; continue; }

        const partyRecords = vote.records || [];
        let votedFor: boolean | null = null;

        if (partyRecords.length === 0) {
          const rawStemmingen = (vote as any).rawData?.Stemming || [];
          const partyNames = [party.abbreviation, party.name].filter(Boolean);
          const partyVote = rawStemmingen.find(
            (s: any) => partyNames.some(n => s.ActorNaam === n)
          );
          if (!partyVote) { noData++; continue; }
          votedFor = partyVote.Soort?.toLowerCase() === "voor";
        } else {
          const forCount = partyRecords.filter((r: any) => r.voteValue === "FOR").length;
          const againstCount = partyRecords.filter((r: any) => r.voteValue === "AGAINST").length;
          votedFor = forCount > againstCount;
        }

        const expectedFor = expectedDir === "VOOR";
        if (votedFor === expectedFor) {
          aligned++;
          weightedAligned += effectiveWeight;
        } else {
          opposed++;
          weightedOpposed += effectiveWeight;
        }
      }

      const totalWithVotes = aligned + opposed;
      const totalWeighted = weightedAligned + weightedOpposed;

      let status: PromiseScore["status"] = "insufficient_data";
      if (totalWithVotes >= MIN_MOTIONS_THRESHOLD && totalWeighted > 0) {
        const ratio = weightedAligned / totalWeighted;
        if (ratio >= 0.70) status = "consistent";
        else if (ratio <= 0.30) status = "inconsistent";
        else status = "mixed";
      }

      if (!byTheme[promise.theme]) {
        byTheme[promise.theme] = { consistent: 0, inconsistent: 0, mixed: 0, total: 0, insufficientData: 0 };
      }
      if (status !== "insufficient_data") {
        byTheme[promise.theme].total++;
        byTheme[promise.theme][status]++;
      } else {
        byTheme[promise.theme].insufficientData++;
      }

      if (status === "consistent") consistentCount++;
      else if (status === "inconsistent") inconsistentCount++;
      else if (status === "mixed") mixedCount++;
      else insufficientDataCount++;

      scoredPromises.push({
        promiseId: promise.id,
        promiseCode: promise.promiseCode,
        summary: promise.summary,
        theme: promise.theme,
        expectedDirection: expectedDir,
        totalMotionsWithVotes: totalWithVotes,
        alignedVotes: aligned,
        opposedVotes: opposed,
        weightedAligned: Math.round(weightedAligned * 100) / 100,
        weightedOpposed: Math.round(weightedOpposed * 100) / 100,
        noVoteData: noData,
        status,
      });
    }

    // Weighted aggregate MCS
    const scored = scoredPromises.filter(p => p.status !== "insufficient_data");
    let weightedConsistencySum = 0;
    let totalMotionWeight = 0;

    for (const p of scored) {
      const weight = p.totalMotionsWithVotes;
      const totalW = p.weightedAligned + p.weightedOpposed;
      const ratio = totalW > 0 ? p.weightedAligned / totalW : 0;
      weightedConsistencySum += ratio * weight;
      totalMotionWeight += weight;
    }

    const mandateConsistencyScore = totalMotionWeight > 0
      ? Math.round((weightedConsistencySum / totalMotionWeight) * 100)
      : 0;

    return {
      partyId: party.id,
      abbreviation: party.abbreviation,
      electionYear,
      periodStart,
      periodEnd,
      totalPromises: promises.length,
      scoredPromises: scored.length,
      insufficientDataPromises: insufficientDataCount,
      consistentCount,
      inconsistentCount,
      mixedCount,
      mandateConsistencyScore,
      matchingAlgorithm: "keyword-overlap-v2",
      note: `Regeerakkoord ${program.title} — coalitieafspraken getoetst aan stemgedrag van ${party.abbreviation}`,
      byTheme,
      promises: scoredPromises,
    };
  }

  // ─── G1: Coalitieverwatering ────────────────────────────
  async getCoalitieverwatering(
    partyIdOrAbbr: string,
    options: { electionYear?: number } = {},
  ): Promise<{
    partyId: string;
    abbreviation: string;
    electionYear: number;
    regeerakkoordTitle: string;
    totalPartyPromises: number;
    survivedCount: number;
    dilutedCount: number;
    dilutionRate: number;
    matches: Array<{
      partyPromise: { code: string; summary: string; keywords: string[] };
      regeerakkoordPromise: { code: string; summary: string; keywords: string[] } | null;
      sharedKeywords: string[];
      survived: boolean;
    }>;
  }> {
    const electionYear = options.electionYear ?? 2026;
    const party = await this.findParty(partyIdOrAbbr);

    // 1. Get the party's verkiezingsbeloften from the latest election BEFORE the regeerakkoord year
    // For 2026 regeerakkoord → TK2025 promises; for 2024 → TK2023 promises
    const partyElectionYear = electionYear <= 2024 ? 2023 : 2025;

    const partyProgram = await prisma.program.findFirst({
      where: {
        partyId: party.id,
        electionYear: partyElectionYear,
        programType: "VERKIEZINGSPROGRAMMA",
      },
    });

    if (!partyProgram) {
      throw new NotFoundException(
        `Geen verkiezingsprogramma gevonden voor ${party.abbreviation} (${partyElectionYear})`
      );
    }

    const partyPromises = await prisma.promise.findMany({
      where: { programId: partyProgram.id },
    });

    // 2. Get regeerakkoord promises where this party is in coalition
    const regeerakkoordProgram = await prisma.program.findFirst({
      where: {
        programType: "REGEERAKKOORD",
        electionYear,
        coalitionPartyIds: { has: party.id },
      },
    });

    if (!regeerakkoordProgram) {
      throw new NotFoundException(
        `Geen regeerakkoord gevonden voor coalitie met ${party.abbreviation} in ${electionYear}`
      );
    }

    const regeerakkoordPromises = await prisma.promise.findMany({
      where: { programId: regeerakkoordProgram.id },
    });

    // 3. Match via keyword overlap (≥3 shared keywords = "survived" coalition negotiations)
    const matches = partyPromises.map(pp => {
      const ppKeywords = new Set((pp.keywords as string[] || []).map(k => k.toLowerCase()));

      let bestMatch: typeof regeerakkoordPromises[0] | null = null;
      let bestShared: string[] = [];

      for (const rp of regeerakkoordPromises) {
        const rpKeywords = (rp.keywords as string[] || []).map(k => k.toLowerCase());
        const shared = rpKeywords.filter(k => ppKeywords.has(k));
        if (shared.length > bestShared.length) {
          bestShared = shared;
          bestMatch = rp;
        }
      }

      const survived = bestShared.length >= 3;

      return {
        partyPromise: {
          code: pp.promiseCode,
          summary: pp.summary,
          keywords: pp.keywords as string[] || [],
        },
        regeerakkoordPromise: survived && bestMatch ? {
          code: bestMatch.promiseCode,
          summary: bestMatch.summary,
          keywords: bestMatch.keywords as string[] || [],
        } : null,
        sharedKeywords: bestShared,
        survived,
      };
    });

    const survivedCount = matches.filter(m => m.survived).length;
    const dilutedCount = partyPromises.length - survivedCount;
    const dilutionRate = partyPromises.length > 0
      ? Math.round((dilutedCount / partyPromises.length) * 100)
      : 0;

    return {
      partyId: party.id,
      abbreviation: party.abbreviation,
      electionYear,
      regeerakkoordTitle: regeerakkoordProgram.title,
      totalPartyPromises: partyPromises.length,
      survivedCount,
      dilutedCount,
      dilutionRate,
      matches,
    };
  }

  // ─── Available election years ────────────────────────────
  async getAvailableYears(): Promise<number[]> {
    const result = await prisma.$queryRaw<{ election_year: number }[]>`
      SELECT DISTINCT prog.election_year
      FROM promises p
      JOIN programs prog ON p.program_id = prog.id
      ORDER BY prog.election_year
    `;
    return result.map(r => r.election_year);
  }

  private async findParty(idOrAbbr: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrAbbr);

    if (isUuid) {
      const byId = await prisma.party.findUnique({ where: { id: idOrAbbr } });
      if (byId) return byId;
    }

    const byTkId = await prisma.party.findUnique({ where: { tkId: idOrAbbr } });
    if (byTkId) return byTkId;

    const byAbbr = await prisma.party.findFirst({
      where: { abbreviation: { equals: idOrAbbr, mode: "insensitive" } },
    });
    if (byAbbr) return byAbbr;

    throw new NotFoundException("Party not found");
  }
}
