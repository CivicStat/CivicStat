/**
 * Purge existing promise-motion matches and optionally cached predictions.
 * Used before re-running the matching pipeline with improvements.
 *
 * Usage:
 *   npx tsx src/scripts/purge-matches.ts                           # Dry run (preview)
 *   npx tsx src/scripts/purge-matches.ts --confirm                 # Delete matches only
 *   npx tsx src/scripts/purge-matches.ts --confirm --predictions   # Delete matches + predictions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PurgeOptions {
  confirm: boolean;
  predictions: boolean;
}

export async function purgeMatches(options: PurgeOptions): Promise<void> {
  const { confirm, predictions } = options;

  if (!confirm) {
    console.log('[PURGE] Dry run — pass --confirm to actually delete.\n');
    const matchCount = await prisma.promiseMotionMatch.count();
    const predictionCount = await prisma.votePrediction.count();
    console.log(`  Would delete: ${matchCount} promise-motion matches`);
    if (predictions) {
      console.log(`  Would delete: ${predictionCount} vote predictions (+ party predictions cascade)`);
    } else {
      console.log(`  Skipping predictions (${predictionCount} exist). Pass --predictions to include.`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log('[PURGE] Deleting all promise-motion matches...');
  const deleteMatches = await prisma.promiseMotionMatch.deleteMany();
  console.log(`  Deleted ${deleteMatches.count} promise-motion matches`);

  if (predictions) {
    console.log('[PURGE] Deleting all vote predictions (cascades to party predictions)...');
    const deletePredictions = await prisma.votePrediction.deleteMany();
    console.log(`  Deleted ${deletePredictions.count} vote predictions`);
  } else {
    console.log('[PURGE] Skipping predictions (pass --predictions to include).');
  }

  console.log('[PURGE] Done.');
  await prisma.$disconnect();
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('purge-matches.ts')) {
  const confirm = process.argv.includes('--confirm');
  const predictions = process.argv.includes('--predictions');
  purgeMatches({ confirm, predictions }).catch(console.error);
}
