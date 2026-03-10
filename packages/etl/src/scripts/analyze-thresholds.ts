/**
 * Analyze semantic match confidence thresholds.
 * Generates a report on confidence distribution, match quality by bucket,
 * and sample matches for manual review.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Overall stats
  const total = await prisma.promiseMotionMatch.count({ where: { matchMethod: 'semantic-claude' } });
  const byType = await prisma.promiseMotionMatch.groupBy({
    by: ['matchType'],
    where: { matchMethod: 'semantic-claude' },
    _count: true,
    _avg: { confidence: true },
    _min: { confidence: true },
    _max: { confidence: true },
  });

  console.log(`\n=== Semantic Match Statistics ===`);
  console.log(`Total matches: ${total}`);
  console.log(`\nBy match type:`);
  for (const t of byType) {
    console.log(
      `  ${t.matchType}: count=${t._count}, avg_conf=${t._avg.confidence?.toFixed(3)}, ` +
      `range=[${t._min.confidence?.toFixed(3)}, ${t._max.confidence?.toFixed(3)}]`
    );
  }

  // 2. Confidence distribution buckets
  const buckets = await prisma.$queryRaw<Array<{
    bucket: string;
    count: number;
    explicit_ct: number;
    implicit_ct: number;
    contradicts_ct: number;
  }>>`
    SELECT
      CASE
        WHEN confidence >= 0.9 THEN '0.90-1.00'
        WHEN confidence >= 0.8 THEN '0.80-0.89'
        WHEN confidence >= 0.7 THEN '0.70-0.79'
        WHEN confidence >= 0.6 THEN '0.60-0.69'
        WHEN confidence >= 0.5 THEN '0.50-0.59'
        WHEN confidence >= 0.4 THEN '0.40-0.49'
        WHEN confidence >= 0.3 THEN '0.30-0.39'
        WHEN confidence < 0.3 THEN '0.00-0.29'
      END as bucket,
      COUNT(*)::int as count,
      (COUNT(*) FILTER (WHERE match_type = 'EXPLICIT_MATCH'))::int as explicit_ct,
      (COUNT(*) FILTER (WHERE match_type = 'IMPLICIT_MATCH'))::int as implicit_ct,
      (COUNT(*) FILTER (WHERE match_type = 'CONTRADICTS'))::int as contradicts_ct
    FROM promise_motion_matches
    WHERE match_method = 'semantic-claude'
    GROUP BY 1
    ORDER BY 1 DESC
  `;

  console.log(`\n=== Confidence Distribution ===`);
  console.log(`${'Bucket'.padEnd(12)} | ${'Total'.padStart(5)} | ${'Explicit'.padStart(8)} | ${'Implicit'.padStart(8)} | ${'Contradicts'.padStart(11)}`);
  console.log('-'.repeat(60));
  let cumulative = 0;
  for (const b of buckets) {
    cumulative += b.count;
    const pct = total > 0 ? ((cumulative / total) * 100).toFixed(1) : '0.0';
    console.log(
      `${(b.bucket || '?').padEnd(12)} | ${String(b.count).padStart(5)} | ` +
      `${String(b.explicit_ct).padStart(8)} | ${String(b.implicit_ct).padStart(8)} | ` +
      `${String(b.contradicts_ct).padStart(11)}  (cum: ${pct}%)`
    );
  }

  // 3. All match methods comparison
  const methods = await prisma.promiseMotionMatch.groupBy({
    by: ['matchMethod'],
    _count: true,
    _avg: { confidence: true },
  });
  console.log(`\n=== All Match Methods ===`);
  for (const m of methods) {
    console.log(`  ${m.matchMethod}: count=${m._count}, avg_conf=${m._avg.confidence?.toFixed(3)}`);
  }

  // 4. Scorecard impact: how many promises have enough data to score
  const promisesWithEnoughMotions = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT pm.promise_id)::int as count
    FROM promise_motion_matches pm
    JOIN votes v ON v.motion_id = pm.motion_id AND v.motion_id IS NOT NULL
    WHERE pm.match_method = 'semantic-claude' AND pm.confidence >= 0.3
    GROUP BY pm.promise_id
    HAVING COUNT(DISTINCT pm.motion_id) >= 3
  `;
  console.log(`\n=== Scorecard Coverage ===`);
  console.log(`Promises with >=3 matched motions with votes (conf>=0.3): ${promisesWithEnoughMotions.length}`);

  // Check at 0.4 threshold
  const at04 = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT pm.promise_id)::int as count
    FROM promise_motion_matches pm
    JOIN votes v ON v.motion_id = pm.motion_id AND v.motion_id IS NOT NULL
    WHERE pm.match_method = 'semantic-claude' AND pm.confidence >= 0.4
    GROUP BY pm.promise_id
    HAVING COUNT(DISTINCT pm.motion_id) >= 3
  `;
  console.log(`Promises with >=3 matched motions with votes (conf>=0.4): ${at04.length}`);

  // Check at 0.5 threshold
  const at05 = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT pm.promise_id)::int as count
    FROM promise_motion_matches pm
    JOIN votes v ON v.motion_id = pm.motion_id AND v.motion_id IS NOT NULL
    WHERE pm.match_method = 'semantic-claude' AND pm.confidence >= 0.5
    GROUP BY pm.promise_id
    HAVING COUNT(DISTINCT pm.motion_id) >= 3
  `;
  console.log(`Promises with >=3 matched motions with votes (conf>=0.5): ${at05.length}`);

  // 5. Sample low-confidence matches for review
  console.log(`\n=== Sample Low-Confidence Matches (0.40-0.49) ===`);
  const lowConfSamples = await prisma.promiseMotionMatch.findMany({
    where: {
      matchMethod: 'semantic-claude',
      confidence: { gte: 0.4, lt: 0.5 },
    },
    include: {
      promise: { select: { summary: true, promiseCode: true, theme: true } },
      motion: { select: { title: true, soort: true } },
    },
    take: 10,
    orderBy: { confidence: 'asc' },
  });
  for (const s of lowConfSamples) {
    console.log(`\n  [${s.matchType}] conf=${s.confidence.toFixed(2)} — ${s.promise.promiseCode} (${s.promise.theme})`);
    console.log(`    Promise: ${s.promise.summary.slice(0, 80)}...`);
    console.log(`    Motion:  ${s.motion.title.slice(0, 80)}...`);
    console.log(`    Reason:  ${(s.rationale || '').slice(0, 120)}`);
  }

  // 6. Sample high-confidence matches for validation
  console.log(`\n=== Sample High-Confidence EXPLICIT Matches (0.80+) ===`);
  const highConfSamples = await prisma.promiseMotionMatch.findMany({
    where: {
      matchMethod: 'semantic-claude',
      matchType: 'EXPLICIT_MATCH',
      confidence: { gte: 0.8 },
    },
    include: {
      promise: { select: { summary: true, promiseCode: true, theme: true } },
      motion: { select: { title: true, soort: true } },
    },
    take: 10,
    orderBy: { confidence: 'desc' },
  });
  for (const s of highConfSamples) {
    console.log(`\n  [${s.matchType}] conf=${s.confidence.toFixed(2)} — ${s.promise.promiseCode} (${s.promise.theme})`);
    console.log(`    Promise: ${s.promise.summary.slice(0, 80)}...`);
    console.log(`    Motion:  ${s.motion.title.slice(0, 80)}...`);
    console.log(`    Reason:  ${(s.rationale || '').slice(0, 120)}`);
  }

  // 7. Sample CONTRADICTS matches
  console.log(`\n=== Sample CONTRADICTS Matches ===`);
  const contradictsSamples = await prisma.promiseMotionMatch.findMany({
    where: {
      matchMethod: 'semantic-claude',
      matchType: 'CONTRADICTS',
    },
    include: {
      promise: { select: { summary: true, promiseCode: true, theme: true } },
      motion: { select: { title: true, soort: true } },
    },
    take: 10,
    orderBy: { confidence: 'desc' },
  });
  for (const s of contradictsSamples) {
    console.log(`\n  [${s.matchType}] conf=${s.confidence.toFixed(2)} — ${s.promise.promiseCode} (${s.promise.theme})`);
    console.log(`    Promise: ${s.promise.summary.slice(0, 80)}...`);
    console.log(`    Motion:  ${s.motion.title.slice(0, 80)}...`);
    console.log(`    Reason:  ${(s.rationale || '').slice(0, 120)}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
