/**
 * Vote Prediction Engine — "Belofte-kloof"
 *
 * For each motion that has promise matches, predict how each party
 * should vote based on their election promises, then compare to
 * actual voting behavior.
 *
 * Algorithm (promise-signal-v1):
 * 1. For each motion, collect all promise matches
 * 2. Group by party (via promise → program → party)
 * 3. For each party: aggregate expected vote direction, weighted by confidence
 * 4. Produce prediction: FOR, AGAINST, or UNKNOWN
 * 5. Store as VotePrediction + PartyPrediction records
 *
 * Usage:
 *   npx tsx src/prediction/predict-vote.ts                  # All motions
 *   npx tsx src/prediction/predict-vote.ts --party VVD      # Only VVD
 *   npx tsx src/prediction/predict-vote.ts --dry-run        # Preview
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALGORITHM_VERSION = 'promise-signal-v1';
const MIN_CONFIDENCE = 0.3; // Skip matches below this threshold
const MIN_SIGNAL = 0.2; // Minimum net signal to produce a FOR/AGAINST prediction

interface PredictionOptions {
  party?: string;
  dryRun?: boolean;
  limit?: number;
}

export async function predictVotes(options: PredictionOptions = {}): Promise<void> {
  const { party, dryRun = false, limit } = options;
  console.log(`[PREDICT] Starting vote prediction (party=${party || 'all'}, dryRun=${dryRun})...`);

  // 1. Count motions with promise matches, then process in batches
  // (Prisma has a napi string conversion bug with large result sets)
  const totalMotionCount = await prisma.motion.count({
    where: { promiseMatches: { some: {} } },
  });
  const effectiveLimit = limit || totalMotionCount;
  console.log(`[PREDICT] Found ${totalMotionCount} motions with promise matches (processing ${effectiveLimit})`);

  let totalPredictions = 0;
  let totalPartyPredictions = 0;

  // Process in batches of 50 to avoid Prisma napi string conversion errors
  const BATCH_SIZE = 50;
  let processedCount = 0;

  for (let batchOffset = 0; processedCount < effectiveLimit; batchOffset += BATCH_SIZE) {
    const batchLimit = Math.min(BATCH_SIZE, effectiveLimit - processedCount);
    const motions = await prisma.motion.findMany({
      where: { promiseMatches: { some: {} } },
      skip: batchOffset,
      take: batchLimit,
      select: {
        id: true,
        title: true,
        promiseMatches: {
          where: { confidence: { gte: MIN_CONFIDENCE } },
          include: {
            promise: {
              include: {
                program: { include: { party: true } },
              },
            },
          },
        },
        votes: {
          take: 1,
          select: {
            id: true,
            result: true,
            totalFor: true,
            totalAgainst: true,
          },
        },
      },
    });

    if (motions.length === 0) break;

  for (const motion of motions) {
    processedCount++;
    if (motion.promiseMatches.length === 0) continue;

    // 2. Group promise matches by party
    const partySignals = new Map<string, {
      partyId: string;
      abbreviation: string;
      forSignal: number;
      againstSignal: number;
      matchCount: number;
      rationale: string[];
    }>();

    for (const match of motion.promiseMatches) {
      const p = match.promise;
      const partyAbbr = p.program.party.abbreviation;
      const partyId = p.program.party.id;

      // Skip if filtering by party
      if (party && partyAbbr.toLowerCase() !== party.toLowerCase()) continue;

      if (!partySignals.has(partyId)) {
        partySignals.set(partyId, {
          partyId,
          abbreviation: partyAbbr,
          forSignal: 0,
          againstSignal: 0,
          matchCount: 0,
          rationale: [],
        });
      }

      const signal = partySignals.get(partyId)!;
      signal.matchCount++;

      // Determine expected direction for this promise-motion pair
      const isContra = match.matchType === 'CONTRADICTS';
      const expectedDir = p.expectedVoteDirection || 'VOOR';
      const weight = match.confidence;

      if (isContra) {
        // Contra match: expected direction is inverted
        if (expectedDir === 'VOOR') {
          signal.againstSignal += weight;
          signal.rationale.push(`${p.promiseCode} contra → TEGEN (${(weight * 100).toFixed(0)}%)`);
        } else {
          signal.forSignal += weight;
          signal.rationale.push(`${p.promiseCode} contra → VOOR (${(weight * 100).toFixed(0)}%)`);
        }
      } else {
        // Direct/implicit match: follow expected direction
        if (expectedDir === 'VOOR') {
          signal.forSignal += weight;
          signal.rationale.push(`${p.promiseCode} → VOOR (${(weight * 100).toFixed(0)}%)`);
        } else {
          signal.againstSignal += weight;
          signal.rationale.push(`${p.promiseCode} → TEGEN (${(weight * 100).toFixed(0)}%)`);
        }
      }
    }

    // 3. Produce predictions per party
    const partyPreds: Array<{
      partyId: string;
      abbreviation: string;
      predictedVote: string;
      confidence: number;
      rationale: string;
    }> = [];

    for (const [, signal] of partySignals) {
      const totalSignal = signal.forSignal + signal.againstSignal;
      if (totalSignal === 0) continue;

      const forRatio = signal.forSignal / totalSignal;
      const againstRatio = signal.againstSignal / totalSignal;
      const netSignal = Math.abs(forRatio - againstRatio);

      let predictedVote = 'UNKNOWN';
      let confidence = 0;

      if (netSignal >= MIN_SIGNAL) {
        if (forRatio > againstRatio) {
          predictedVote = 'FOR';
          confidence = forRatio;
        } else {
          predictedVote = 'AGAINST';
          confidence = againstRatio;
        }
      }

      partyPreds.push({
        partyId: signal.partyId,
        abbreviation: signal.abbreviation,
        predictedVote,
        confidence: Math.min(confidence, 1),
        rationale: signal.rationale.slice(0, 5).join('; '),
      });
    }

    if (partyPreds.length === 0) continue;

    if (dryRun) {
      const voteResult = motion.votes[0]?.result || 'geen stemming';
      console.log(`\n[PREDICT] Motion: ${motion.title?.slice(0, 60)}... (${voteResult})`);
      for (const pp of partyPreds) {
        console.log(`  ${pp.abbreviation.padEnd(12)} → ${pp.predictedVote.padEnd(8)} (${(pp.confidence * 100).toFixed(0)}%) [${pp.rationale.slice(0, 80)}]`);
      }
    } else {
      // Use raw SQL since the Prisma client may not have the new models yet
      // Upsert VotePrediction (cast to uuid for PostgreSQL)
      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM vote_predictions WHERE motion_id = $1::uuid AND algorithm_version = $2`,
        motion.id, ALGORITHM_VERSION,
      );

      let vpId: string;
      if (existing.length > 0) {
        vpId = existing[0].id;
        await prisma.$executeRawUnsafe(
          `UPDATE vote_predictions SET created_at = NOW() WHERE id = $1::uuid`,
          vpId,
        );
      } else {
        const inserted: any[] = await prisma.$queryRawUnsafe(
          `INSERT INTO vote_predictions (id, motion_id, algorithm_version, created_at) VALUES (gen_random_uuid(), $1::uuid, $2, NOW()) RETURNING id`,
          motion.id, ALGORITHM_VERSION,
        );
        vpId = inserted[0].id;
      }

      // Delete existing party predictions
      await prisma.$executeRawUnsafe(
        `DELETE FROM party_predictions WHERE vote_prediction_id = $1::uuid`,
        vpId,
      );

      // Insert party predictions
      for (const pp of partyPreds) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO party_predictions (id, vote_prediction_id, party_id, predicted_vote, confidence, rationale, created_at) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, NOW())`,
          vpId, pp.partyId, pp.predictedVote, pp.confidence, pp.rationale,
        );
      }

      totalPredictions++;
      totalPartyPredictions += partyPreds.length;
      console.log(`[PREDICT] ✅ ${motion.title?.slice(0, 50)}... → ${partyPreds.length} party predictions`);
    }
  } // end for motion
  } // end batch loop

  if (!dryRun) {
    console.log(`\n[PREDICT] ✅ Complete: ${totalPredictions} motions, ${totalPartyPredictions} party predictions`);
  }

  await prisma.$disconnect();
}

// ─── CLI entry point ────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('predict-vote.ts')) {
  const args = process.argv.slice(2);
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;

  predictVotes({
    party: partyArg,
    dryRun,
    limit: limitArg ? parseInt(limitArg) : undefined,
  }).catch(console.error);
}
