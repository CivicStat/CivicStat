/**
 * Generate a review report of top matches for manual QA.
 *
 * Output: JSON file with top 50 matches per category:
 * 1. Highest confidence matches (most likely correct)
 * 2. Borderline matches (confidence near threshold — most likely to be wrong)
 *
 * For each match, show:
 * - Promise text + code
 * - Motion title + description
 * - Confidence score
 * - Shared keywords
 * - Match type
 *
 * Human reviewer marks each as: CORRECT / INCORRECT / UPGRADE_TO_EXPLICIT / DOWNGRADE
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));
const REVIEW_DIR = join(__dirname, '../../data/review');

interface ReviewEntry {
  matchId: string;
  promiseCode: string;
  promiseText: string;
  promiseTheme: string;
  motionTitle: string;
  motionDescription: string | null;
  confidence: number;
  matchType: string;
  sharedKeywords: string | null;
  review: string | null; // CORRECT / INCORRECT / UPGRADE_TO_EXPLICIT / DOWNGRADE
}

function formatMatch(m: any): ReviewEntry {
  return {
    matchId: m.id,
    promiseCode: m.promise.promiseCode,
    promiseText: m.promise.text,
    promiseTheme: m.promise.theme,
    motionTitle: m.motion.title,
    motionDescription: m.motion.text?.substring(0, 300) || null,
    confidence: m.confidence,
    matchType: m.matchType,
    sharedKeywords: m.rationale,
    review: null,
  };
}

export async function generateReviewReport(): Promise<void> {
  console.log('[REVIEW] Generating match review report...');

  // Top 50 highest confidence
  const topConfidence = await prisma.promiseMotionMatch.findMany({
    take: 50,
    orderBy: { confidence: 'desc' },
    include: {
      promise: true,
      motion: true,
    },
  });

  // 50 borderline (confidence between 0.30 and 0.45)
  const borderline = await prisma.promiseMotionMatch.findMany({
    where: {
      confidence: { gte: 0.30, lte: 0.45 },
    },
    take: 50,
    orderBy: { confidence: 'asc' },
    include: {
      promise: true,
      motion: true,
    },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    topConfidence: topConfidence.map(formatMatch),
    borderline: borderline.map(formatMatch),
  };

  const outputPath = join(REVIEW_DIR, 'match-review-batch-b.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`[REVIEW] Report generated:`);
  console.log(`  Top confidence: ${topConfidence.length} matches`);
  console.log(`  Borderline: ${borderline.length} matches`);
  console.log(`  Output: ${outputPath}`);

  await prisma.$disconnect();
}

/**
 * Apply review corrections from the JSON report after human review.
 */
export async function applyReviewResults(reviewFile?: string): Promise<void> {
  const filePath = reviewFile || join(REVIEW_DIR, 'match-review-batch-b.json');

  if (!existsSync(filePath)) {
    console.error(`[REVIEW] Review file not found: ${filePath}`);
    process.exit(1);
  }

  const reviews = JSON.parse(readFileSync(filePath, 'utf-8'));
  let deleted = 0;
  let upgraded = 0;
  let downgraded = 0;

  for (const category of ['topConfidence', 'borderline'] as const) {
    for (const match of reviews[category]) {
      if (!match.review) continue;

      switch (match.review) {
        case 'INCORRECT':
          await prisma.promiseMotionMatch.delete({ where: { id: match.matchId } });
          deleted++;
          break;
        case 'UPGRADE_TO_EXPLICIT':
          await prisma.promiseMotionMatch.update({
            where: { id: match.matchId },
            data: {
              matchType: 'EXPLICIT_MATCH',
              reviewedBy: 'human',
              reviewedAt: new Date(),
            },
          });
          upgraded++;
          break;
        case 'DOWNGRADE':
          await prisma.promiseMotionMatch.update({
            where: { id: match.matchId },
            data: {
              confidence: match.confidence * 0.5,
              reviewedBy: 'human',
              reviewedAt: new Date(),
            },
          });
          downgraded++;
          break;
        // CORRECT: no action needed
      }
    }
  }

  console.log(`[REVIEW] Applied review results:`);
  console.log(`  Deleted (incorrect): ${deleted}`);
  console.log(`  Upgraded to explicit: ${upgraded}`);
  console.log(`  Downgraded: ${downgraded}`);

  await prisma.$disconnect();
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('review-matches.ts')) {
  const args = process.argv.slice(2);
  if (args[0] === 'apply') {
    applyReviewResults(args[1]).catch(console.error);
  } else {
    generateReviewReport().catch(console.error);
  }
}
