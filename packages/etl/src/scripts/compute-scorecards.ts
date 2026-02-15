/**
 * compute-scorecards.ts
 *
 * Pre-computes all party scorecards and upserts them into the
 * precomputed_scorecards table.  The API then reads these instead
 * of computing on-the-fly (~900ms per scorecard → ~50ms SELECT).
 *
 * Usage:
 *   npx tsx src/index.ts compute-scorecards
 *   npx tsx src/index.ts compute-scorecards --party VVD
 *   npx tsx src/index.ts compute-scorecards --year 2023
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Constants (mirrored from API scorecard service) ────────

const MATCH_TYPE_WEIGHTS: Record<string, number> = {
  EXPLICIT_MATCH: 1.0,
  IMPLICIT_MATCH: 0.5,
  CONTRADICTS: 1.0,
};

const MIN_MOTIONS_THRESHOLD = 3;

const PERIOD_DEFAULTS: Record<number, { start: string; end: string }> = {
  2023: { start: "2023-11-22", end: "2099-12-31" },
  2025: { start: "2023-11-22", end: "2099-12-31" },
};

// ─── Types ──────────────────────────────────────────────────

interface PromiseScore {
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

interface ScorecardResult {
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

// ─── Scoring Logic (exact replica of API service) ───────────

async function computeScorecard(
  partyId: string,
  partyAbbr: string,
  partyName: string,
  electionYear: number,
  programType: "VERKIEZINGSPROGRAMMA" | "REGEERAKKOORD" = "VERKIEZINGSPROGRAMMA",
): Promise<ScorecardResult | null> {
  const periodDefaults = PERIOD_DEFAULTS[electionYear] ?? PERIOD_DEFAULTS[2023];
  const periodStart = periodDefaults.start;
  const periodEnd = periodDefaults.end;

  // Find promises for this party/year/programType
  const whereClause: any = { program: { electionYear, programType } };

  if (programType === "VERKIEZINGSPROGRAMMA") {
    whereClause.program.partyId = partyId;
  } else {
    // Regeerakkoord: find program where this party is in the coalition
    const program = await prisma.program.findFirst({
      where: {
        programType: "REGEERAKKOORD",
        electionYear,
        coalitionPartyIds: { has: partyId },
      },
    });
    if (!program) return null;
    whereClause.programId = program.id;
    delete whereClause.program;
  }

  const promises = await prisma.promise.findMany({
    where: whereClause,
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
                    where: { partyIdSnapshot: partyId },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (promises.length === 0) return null;

  // Score each promise
  const scoredPromises: PromiseScore[] = [];
  let consistentCount = 0;
  let inconsistentCount = 0;
  let mixedCount = 0;
  let insufficientDataCount = 0;
  const byTheme: Record<string, { consistent: number; inconsistent: number; mixed: number; total: number; insufficientData: number }> = {};

  for (const promise of promises) {
    const expectedDir = promise.expectedVoteDirection || (programType === "REGEERAKKOORD" ? "VOOR" : null);
    if (!expectedDir) continue;

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

      const partyRecords = (vote as any).records || [];
      let votedFor: boolean | null = null;

      if (partyRecords.length === 0) {
        const rawStemmingen = (vote as any).rawData?.Stemming || [];
        const partyNames = [partyAbbr, partyName].filter(Boolean);
        const partyVote = rawStemmingen.find(
          (s: any) => partyNames.some((n: string) => s.ActorNaam === n),
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
    partyId,
    abbreviation: partyAbbr,
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

// ─── Main ───────────────────────────────────────────────────

export async function computeScorecards(opts: {
  party?: string;
  year?: number;
} = {}) {
  console.log("📊 Computing party scorecards...\n");

  const years = opts.year ? [opts.year] : [2023, 2025];

  // Find all parties that have promises
  const partyRows = await prisma.$queryRaw<{ party_id: string; election_year: number }[]>`
    SELECT DISTINCT prog.party_id, prog.election_year
    FROM promises p
    JOIN programs prog ON p.program_id = prog.id
    WHERE prog.election_year = ANY(${years})
      AND prog.program_type = 'VERKIEZINGSPROGRAMMA'
  `;

  // Get unique party IDs
  const allPartyIds = [...new Set(partyRows.map(r => r.party_id))];

  // Fetch party details
  const parties = await prisma.party.findMany({
    where: { id: { in: allPartyIds } },
    select: { id: true, abbreviation: true, name: true },
  });

  // Filter by --party flag if provided
  const filteredParties = opts.party
    ? parties.filter(p => p.abbreviation.toLowerCase() === opts.party!.toLowerCase())
    : parties;

  if (filteredParties.length === 0) {
    console.log("⚠️  No parties found matching criteria.");
    return;
  }

  let upsertCount = 0;
  let errorCount = 0;

  for (const party of filteredParties) {
    for (const year of years) {
      // Check if this party has promises for this year
      const hasPromises = partyRows.some(
        r => r.party_id === party.id && r.election_year === year,
      );
      if (!hasPromises) continue;

      try {
        const scorecard = await computeScorecard(
          party.id,
          party.abbreviation,
          party.name,
          year,
          "VERKIEZINGSPROGRAMMA",
        );

        if (!scorecard) {
          console.log(`  ⏭️  ${party.abbreviation} (TK${year}): no promises`);
          continue;
        }

        // Upsert into precomputed_scorecards
        await prisma.precomputedScorecard.upsert({
          where: {
            partyId_electionYear_programType: {
              partyId: party.id,
              electionYear: year,
              programType: "VERKIEZINGSPROGRAMMA",
            },
          },
          update: {
            mcs: scorecard.mandateConsistencyScore,
            totalPromises: scorecard.totalPromises,
            scoredPromises: scorecard.scoredPromises,
            consistentCount: scorecard.consistentCount,
            inconsistentCount: scorecard.inconsistentCount,
            mixedCount: scorecard.mixedCount,
            detailJson: scorecard as any,
            computedAt: new Date(),
            algorithmVersion: "semantic-claude-v1",
          },
          create: {
            partyId: party.id,
            electionYear: year,
            programType: "VERKIEZINGSPROGRAMMA",
            mcs: scorecard.mandateConsistencyScore,
            totalPromises: scorecard.totalPromises,
            scoredPromises: scorecard.scoredPromises,
            consistentCount: scorecard.consistentCount,
            inconsistentCount: scorecard.inconsistentCount,
            mixedCount: scorecard.mixedCount,
            detailJson: scorecard as any,
            algorithmVersion: "semantic-claude-v1",
          },
        });

        upsertCount++;
        console.log(
          `  ✅ ${party.abbreviation} (TK${year}): MCS ${scorecard.mandateConsistencyScore}, ${scorecard.scoredPromises}/${scorecard.totalPromises} scored`,
        );
      } catch (err) {
        errorCount++;
        console.error(`  ❌ ${party.abbreviation} (TK${year}):`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`\n📊 Done. ${upsertCount} scorecards computed, ${errorCount} errors.\n`);
}
