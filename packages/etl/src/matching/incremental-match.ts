/**
 * Incremental Inverse Matcher
 *
 * For each NEW motion (no existing semantic matches), finds candidate promises
 * via keyword overlap, then evaluates relevance with AI.
 *
 * Direction: Motion → Promises (inverse of the full-corpus forward matcher)
 *
 * This runs as part of the hourly `sync` pipeline to keep scorecards
 * up-to-date as new motions are filed in the Tweede Kamer.
 *
 * Usage:
 *   npx tsx src/index.ts incremental-match
 *   npx tsx src/index.ts incremental-match --dry-run
 *   npx tsx src/index.ts incremental-match --limit 5
 *
 * Environment:
 *   OPENROUTER_API_KEY — Preferred: OpenRouter key
 *   ANTHROPIC_API_KEY  — Fallback: direct Anthropic API
 *   AI_MODEL_INCREMENTAL_MATCH — Override model (default: Sonnet 4)
 */

import { PrismaClient } from '@prisma/client';
import type { PromiseMatchType } from '@prisma/client';
import { shouldMatchMotion } from './motion-filter.js';
import { THEME_KEYWORDS } from './semantic-matcher.js';
import { createAIClient, chatWithRetry, getModel, modelShortName } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';

const prisma = new PrismaClient();

// ─── Configuration ──────────────────────────────────────────────

const MATCH_METHOD = 'semantic-claude';
const ALGORITHM_VERSION = 'incremental-inverse-v1';
const BATCH_SIZE = 16;              // promises per AI call
const MIN_KEYWORD_OVERLAP = 2;      // minimum shared keywords to be a candidate
const MAX_CANDIDATES = 80;          // cap candidate promises per motion
const MIN_CONFIDENCE = 0.4;         // minimum confidence to store a match
const RATE_LIMIT_MS = 100;          // delay between API calls

// Dutch stop words for keyword extraction
const STOP_WORDS = new Set([
  'de', 'het', 'een', 'van', 'in', 'is', 'op', 'te', 'dat', 'die', 'en',
  'voor', 'met', 'zijn', 'er', 'aan', 'worden', 'door', 'ook', 'als',
  'wordt', 'niet', 'om', 'maar', 'naar', 'bij', 'nog', 'uit', 'kan',
  'heeft', 'meer', 'dan', 'over', 'wel', 'moet', 'hun', 'veel', 'tot',
  'zou', 'deze', 'dit', 'wat', 'alle', 'geen', 'onder', 'zeer', 'wordt',
  'verzoekt', 'regering', 'kamer', 'spreekt', 'constaterende', 'overwegende',
  'motie', 'tweede', 'minister', 'kabinet',
]);

// ─── Types ──────────────────────────────────────────────────────

interface CachedPromise {
  id: string;
  promiseCode: string;
  text: string;
  summary: string;
  theme: string;
  keywords: string[];
  partyAbbr: string;
}

interface MatchResult {
  promiseIndex: number;
  promiseCode: string;
  matchType: string;
  confidence: number;
  predictedDirection: string;
  rationale: string;
}

export interface IncrementalMatchOptions {
  dryRun?: boolean;
  limit?: number;
  concurrency?: number;
  maxCostCents?: number;  // default 500 = $5.00
}

export interface IncrementalMatchResult {
  motionsProcessed: number;
  motionsSkipped: number;
  matchesCreated: number;
  apiCallsMade: number;
  errors: string[];
}

// ─── Utilities ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  return new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── 1. Find Unmatched Motions ──────────────────────────────────

async function findUnmatchedMotions(limit?: number) {
  const motions = await prisma.motion.findMany({
    where: {
      promiseMatches: {
        none: {
          matchMethod: MATCH_METHOD,
        },
      },
    },
    select: {
      id: true,
      tkId: true,
      tkNumber: true,
      title: true,
      text: true,
      soort: true,
      dateIntroduced: true,
    },
    orderBy: { dateIntroduced: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  // Filter out procedural motions
  return motions.filter((m) => {
    const result = shouldMatchMotion({
      title: m.title,
      description: m.text || undefined,
      soort: m.soort,
    });
    return !result.excluded;
  });
}

// ─── 2. Extract Keywords from Motion ────────────────────────────

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-zàáâãäåèéêëìíîïòóôõöùúûüýÿ\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // Deduplicate
  return [...new Set(words)];
}

function detectThemes(keywords: string[]): string[] {
  const kwSet = new Set(keywords);
  const themes: string[] = [];

  for (const [theme, themeKws] of Object.entries(THEME_KEYWORDS)) {
    let matches = 0;
    for (const tkw of themeKws) {
      // Check both single-word and multi-word theme keywords
      if (tkw.includes(' ')) {
        // Multi-word: check if all parts are in keywords
        const parts = tkw.split(' ');
        if (parts.every((p) => kwSet.has(p))) matches++;
      } else if (kwSet.has(tkw)) {
        matches++;
      }
    }
    if (matches >= 2) themes.push(theme);
  }

  return themes;
}

// ─── 3. Find Candidate Promises ─────────────────────────────────

function findCandidatePromises(
  motionKeywords: Set<string>,
  motionThemes: string[],
  allPromises: CachedPromise[],
): CachedPromise[] {
  const scored: Array<{ promise: CachedPromise; score: number }> = [];

  for (const promise of allPromises) {
    let score = 0;

    // Keyword overlap
    const promiseKws = promise.keywords.length > 0
      ? promise.keywords.map((k) => k.toLowerCase())
      : extractKeywords(`${promise.text} ${promise.summary}`);

    for (const kw of promiseKws) {
      if (motionKeywords.has(kw)) score += 1;
    }

    // Theme match bonus
    if (motionThemes.includes(promise.theme)) {
      score += 2;
    }

    // Theme keywords boost (promise theme keywords in motion)
    const themeKws = THEME_KEYWORDS[promise.theme] || [];
    for (const tkw of themeKws) {
      if (motionKeywords.has(tkw)) score += 0.5;
    }

    if (score >= MIN_KEYWORD_OVERLAP) {
      scored.push({ promise, score });
    }
  }

  // Sort by score descending, cap at MAX_CANDIDATES
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CANDIDATES).map((s) => s.promise);
}

// ─── 4. Build Inverse Match Prompt ──────────────────────────────

function buildInversePrompt(
  motion: { title: string; text: string },
  promises: CachedPromise[],
): string {
  const promiseBlock = promises
    .map((p, i) =>
      `--- BELOFTE ${i} ---\n` +
      `Code: ${p.promiseCode}\n` +
      `Partij: ${p.partyAbbr}\n` +
      `Samenvatting: ${p.summary}\n` +
      `Tekst: ${p.text.slice(0, 400)}`
    )
    .join('\n\n');

  return `Je bent een neutrale politieke analist voor CivicStat. Beoordeel of de onderstaande VERKIEZINGSBELOFTEN inhoudelijk verband houden met deze MOTIE.

MOTIE:
Titel: ${motion.title}
Tekst: ${motion.text?.slice(0, 800) || '(geen tekst)'}

BELOFTEN:
${promiseBlock}

BEOORDELINGSREGELS:
- EXPLICIT: De motie gaat DIRECT over hetzelfde onderwerp als de belofte EN vraagt om een concrete actie die de belofte zou vervullen of blokkeren. Wees STRIKT: alleen EXPLICIT als er een duidelijk, direct verband is.
- IMPLICIT: De motie raakt het thema van de belofte, maar is niet een directe uitvoering of blokkering ervan.
- CONTRADICTS: De motie vraagt om het TEGENOVERGESTELDE van wat de belofte beoogt.
- NO_MATCH: Geen inhoudelijk verband met de belofte.
- predictedDirection: Zou de partij op basis van deze belofte VOOR of TEGEN deze motie stemmen? Gebruik "VOOR" of "TEGEN".
- confidence: Een getal tussen 0.0 en 1.0 dat aangeeft hoe zeker je bent over de match.

Antwoord ALLEEN met een valid JSON array, geen uitleg:
[
  {
    "promiseIndex": 0,
    "matchType": "EXPLICIT|IMPLICIT|CONTRADICTS|NO_MATCH",
    "confidence": 0.0,
    "predictedDirection": "VOOR|TEGEN",
    "matchReason": "Korte uitleg in het Nederlands (max 100 woorden)"
  }
]

Geef een element voor ELKE belofte (${promises.length} items). Wees streng met EXPLICIT — gebruik dit alleen bij een duidelijk, direct verband.`;
}

// ─── 5. Parse AI Response ───────────────────────────────────────

function parseResponse(responseText: string): MatchResult[] {
  let jsonStr = responseText.trim();

  // Strip markdown code fences if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.warn(`    [WARN] Response is not an array`);
      return [];
    }
    return parsed.map((r: any) => ({
      promiseIndex: r.promiseIndex ?? r.index ?? -1,
      promiseCode: r.promiseCode || '',
      matchType: r.matchType || 'NO_MATCH',
      confidence: typeof r.confidence === 'number' ? r.confidence : 0,
      predictedDirection: r.predictedDirection || '',
      rationale: r.matchReason || r.rationale || '',
    }));
  } catch (err) {
    console.warn(`    [WARN] Failed to parse response: ${(err as Error).message}`);
    return [];
  }
}

// ─── Match Type Mapping ─────────────────────────────────────────

const MATCH_TYPE_MAP: Record<string, PromiseMatchType> = {
  EXPLICIT: 'EXPLICIT_MATCH' as PromiseMatchType,
  IMPLICIT: 'IMPLICIT_MATCH' as PromiseMatchType,
  CONTRADICTS: 'CONTRADICTS' as PromiseMatchType,
  EXPLICIT_MATCH: 'EXPLICIT_MATCH' as PromiseMatchType,
  IMPLICIT_MATCH: 'IMPLICIT_MATCH' as PromiseMatchType,
};

// ─── 6. Main Orchestrator ───────────────────────────────────────

export async function runIncrementalMatch(
  options: IncrementalMatchOptions = {},
): Promise<IncrementalMatchResult> {
  const { dryRun = false, limit, maxCostCents = 500 } = options;

  const result: IncrementalMatchResult = {
    motionsProcessed: 0,
    motionsSkipped: 0,
    matchesCreated: 0,
    apiCallsMade: 0,
    errors: [],
  };

  // Get the model for incremental matching
  const modelEnv = process.env.AI_MODEL_INCREMENTAL_MATCH;
  const model = modelEnv || getModel('semantic-match');

  // Initialize AI client
  let ai: AIClient | null = null;
  if (!dryRun) {
    ai = createAIClient();
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  INCREMENTAL MATCHING — CivicStat`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  Provider: ${ai?.provider || 'dry-run'}`);
  console.log(`  Model:    ${modelShortName(model)}`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Limit:    ${limit || 'all'}`);
  console.log(`  Max cost: $${(maxCostCents / 100).toFixed(2)}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  // 1. Find unmatched motions
  const unmatchedMotions = await findUnmatchedMotions(limit);
  console.log(`[${timestamp()}] Found ${unmatchedMotions.length} unmatched motions\n`);

  if (unmatchedMotions.length === 0) {
    console.log(`[${timestamp()}] Nothing to match — all motions have semantic matches.\n`);
    await prisma.$disconnect();
    return result;
  }

  // 2. Load all promises (cached for the run)
  const allPromisesRaw = await prisma.promise.findMany({
    select: {
      id: true,
      promiseCode: true,
      text: true,
      summary: true,
      theme: true,
      keywords: true,
      program: {
        select: {
          party: { select: { abbreviation: true } },
        },
      },
    },
  });

  const allPromises: CachedPromise[] = allPromisesRaw.map((p) => ({
    id: p.id,
    promiseCode: p.promiseCode,
    text: p.text,
    summary: p.summary,
    theme: p.theme,
    keywords: p.keywords,
    partyAbbr: p.program.party.abbreviation,
  }));

  console.log(`[${timestamp()}] Loaded ${allPromises.length} promises for candidate matching\n`);

  // Approximate cost tracking (Sonnet 4 pricing)
  let estimatedCostCents = 0;
  const COST_PER_CALL_CENTS = 0.5; // ~$0.005 per call

  // 3. Process each unmatched motion
  for (let i = 0; i < unmatchedMotions.length; i++) {
    const motion = unmatchedMotions[i];

    // Cost circuit breaker
    if (estimatedCostCents > maxCostCents) {
      console.warn(`\n[${timestamp()}] ⚠️  Cost limit reached ($${(estimatedCostCents / 100).toFixed(2)}), stopping.`);
      break;
    }

    // Extract keywords and detect themes
    const keywords = extractKeywords(`${motion.title} ${motion.text}`);
    const motionKeywordSet = new Set(keywords);
    const themes = detectThemes(keywords);

    // Find candidate promises
    const candidates = findCandidatePromises(motionKeywordSet, themes, allPromises);

    if (candidates.length === 0) {
      result.motionsSkipped++;
      // Mark as "processed" by creating a sentinel (no real matches)
      // Skip — will be picked up again next run but with same result
      console.log(`  [${i + 1}/${unmatchedMotions.length}] ${motion.tkNumber || motion.tkId.slice(0, 8)} — 0 candidates, skipping`);
      continue;
    }

    if (dryRun) {
      console.log(
        `  [${i + 1}/${unmatchedMotions.length}] ${motion.tkNumber || motion.tkId.slice(0, 8)} — ` +
        `"${motion.title.slice(0, 60)}..." → ${candidates.length} candidate promises, ` +
        `themes: [${themes.join(', ')}], keywords: ${keywords.length}`
      );
      result.motionsProcessed++;
      continue;
    }

    // Batch candidates into groups and call AI
    let motionMatches = 0;

    for (let batchStart = 0; batchStart < candidates.length; batchStart += BATCH_SIZE) {
      const batch = candidates.slice(batchStart, batchStart + BATCH_SIZE);
      const prompt = buildInversePrompt(motion, batch);

      try {
        const response = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
          onRetry: (attempt, delay, error) => {
            console.warn(`    [RETRY] API ${error.status}, attempt ${attempt}/3, waiting ${delay}ms...`);
          },
          traceName: 'incremental-match',
          traceTags: ['etl', 'incremental-match'],
        });

        result.apiCallsMade++;
        estimatedCostCents += COST_PER_CALL_CENTS;

        const parsed = parseResponse(response.text);

        for (const match of parsed) {
          // Validate index
          if (match.promiseIndex < 0 || match.promiseIndex >= batch.length) continue;

          // Skip NO_MATCH or low confidence
          if (match.matchType === 'NO_MATCH' || match.confidence < MIN_CONFIDENCE) continue;

          // Map match type
          const dbMatchType = MATCH_TYPE_MAP[match.matchType];
          if (!dbMatchType) continue;

          // Validate direction
          const direction =
            match.predictedDirection === 'VOOR' || match.predictedDirection === 'TEGEN'
              ? match.predictedDirection
              : null;

          // Upsert match
          try {
            await prisma.promiseMotionMatch.upsert({
              where: {
                promiseId_motionId: {
                  promiseId: batch[match.promiseIndex].id,
                  motionId: motion.id,
                },
              },
              create: {
                promiseId: batch[match.promiseIndex].id,
                motionId: motion.id,
                matchType: dbMatchType,
                confidence: Math.min(Math.max(match.confidence, 0), 1),
                rationale: match.rationale || '',
                matchMethod: MATCH_METHOD,
                algorithmVersion: ALGORITHM_VERSION,
                predictedDirection: direction,
              },
              update: {
                matchType: dbMatchType,
                confidence: Math.min(Math.max(match.confidence, 0), 1),
                rationale: match.rationale || '',
                algorithmVersion: ALGORITHM_VERSION,
                predictedDirection: direction,
              },
            });

            motionMatches++;
            result.matchesCreated++;
          } catch (err) {
            // Skip duplicate errors silently
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message || String(err);
        console.error(`    [ERROR] ${motion.tkNumber}: ${errMsg.slice(0, 150)}`);
        result.errors.push(`${motion.tkNumber}: ${errMsg.slice(0, 200)}`);
      }

      await sleep(RATE_LIMIT_MS);
    }

    result.motionsProcessed++;
    console.log(
      `  [${i + 1}/${unmatchedMotions.length}] ${motion.tkNumber || motion.tkId.slice(0, 8)} — ` +
      `${candidates.length} candidates → ${motionMatches} matches`
    );
  }

  // Summary
  console.log(`\n═══ Incremental Matching Complete ═══`);
  console.log(`  Motions processed:  ${result.motionsProcessed}`);
  console.log(`  Motions skipped:    ${result.motionsSkipped} (no candidates)`);
  console.log(`  Matches created:    ${result.matchesCreated}`);
  console.log(`  API calls:          ${result.apiCallsMade}`);
  console.log(`  Estimated cost:     $${(estimatedCostCents / 100).toFixed(2)}`);
  console.log(`  Errors:             ${result.errors.length}`);
  console.log(`═════════════════════════════════════\n`);

  await prisma.$disconnect();
  return result;
}
