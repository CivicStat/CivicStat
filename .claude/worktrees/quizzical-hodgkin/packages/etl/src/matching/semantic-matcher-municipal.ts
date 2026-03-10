/**
 * Municipal Semantic Promise ↔ Motion Matcher (2026)
 *
 * Adapted from semantic-matcher.ts for municipal context.
 * Matches 2026 verkiezingsprogramma promises against 2022-2026 raadsmoties.
 *
 * Key differences from TK matcher:
 *   - Parliament-scoped: MUST filter by parliamentId. Never cross-match.
 *   - Municipal theme keywords (12 themes vs TK 17)
 *   - Municipal terminology in LLM prompt (gemeenteraad, wethouder, B&W)
 *   - Forward-looking frame: 2026 promises vs 2022-2026 voting record
 *   - matchMethod = "semantic-municipal-2026"
 *   - Separate progress files per city
 *
 * Usage:
 *   npx tsx src/index.ts semantic-match-municipal --parliament amsterdam-gemeente
 *   npx tsx src/index.ts semantic-match-municipal --parliament den-haag-gemeente
 *   npx tsx src/index.ts semantic-match-municipal --parliament amsterdam-gemeente --resume
 *   npx tsx src/index.ts semantic-match-municipal --parliament amsterdam-gemeente --limit 20
 *   npx tsx src/index.ts semantic-match-municipal --all
 */

import { PrismaClient, PromiseMatchType } from '@prisma/client';
import { shouldMatchMotion } from './motion-filter.js';
import { createAIClient, chatWithRetry, getModel, modelShortName, AIError } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// ─── Configuration ──────────────────────────────────────────────

const MAX_CANDIDATES = 100; // Broader net — municipal motion sets are small (~576)
const BATCH_SIZE = 16;
const MIN_CONFIDENCE = 0.4;
const RATE_LIMIT_MS = 100;
const MATCH_METHOD = 'semantic-municipal-2026';
const ALGORITHM_VERSION = 'semantic-municipal-2026-v1';
const PROGRESS_SAVE_INTERVAL = 20;
const CONCURRENCY = 5;

// ─── Progress Tracking ─────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProgressFilePath(parliamentSlug: string): string {
  return path.join(__dirname, `../../data/semantic-progress-${parliamentSlug}-2026.json`);
}

interface ProgressState {
  processedPromiseIds: string[];
  totalProcessed: number;
  totalMatches: number;
  totalSkipped: number;
  matchBreakdown: {
    explicit: number;
    implicit: number;
    contradicts: number;
  };
  totalApiCalls: number;
  totalCandidates: number;
  startedAt: string;
  lastUpdatedAt: string;
  errors: Array<{ promiseId: string; error: string; timestamp: string }>;
}

function loadProgress(filePath: string): ProgressState {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(data) as ProgressState;
    if (!state.matchBreakdown) state.matchBreakdown = { explicit: 0, implicit: 0, contradicts: 0 };
    if (!state.errors) state.errors = [];
    if (!state.totalProcessed) state.totalProcessed = state.processedPromiseIds?.length ?? 0;
    if (!state.totalMatches) state.totalMatches = 0;
    if (!state.totalSkipped) state.totalSkipped = 0;
    if (!state.totalApiCalls) state.totalApiCalls = 0;
    if (!state.totalCandidates) state.totalCandidates = 0;
    if (!state.startedAt) state.startedAt = new Date().toISOString();
    if (!state.lastUpdatedAt) state.lastUpdatedAt = new Date().toISOString();
    return state;
  } catch {
    return {
      processedPromiseIds: [],
      totalProcessed: 0,
      totalMatches: 0,
      totalSkipped: 0,
      matchBreakdown: { explicit: 0, implicit: 0, contradicts: 0 },
      totalApiCalls: 0,
      totalCandidates: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      errors: [],
    };
  }
}

function saveProgress(state: ProgressState, filePath: string): void {
  state.lastUpdatedAt = new Date().toISOString();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

// ─── Utilities ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPool(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  }
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        try { resolve(await fn()); }
        catch (err) { reject(err); }
        finally { active--; next(); }
      };
      queue.push(execute);
      next();
    });
  };
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timestamp(): string {
  return new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Municipal Theme Keywords ───────────────────────────────────

const MUNICIPAL_THEME_KEYWORDS: Record<string, string[]> = {
  WONEN: [
    'sociale huur', 'woningbouw', 'huurprijs', 'woningnood', 'bouwen', 'woonruimte',
    'corporatie', 'middenhuur', 'zelfbouw', 'woningvoorraad', 'huisvesting', 'kraak',
    'leegstand', 'woonbeleid', 'gentrificatie', 'woning', 'huur', 'koop', 'huurder',
  ],
  VERKEER: [
    'fiets', 'ov', 'tram', 'metro', 'bus', 'parkeren', 'verkeersveiligheid',
    'autoluw', 'fietspaden', 'verkeersdrempel', 'snelheid', 'deelmobiliteit',
    'laadpalen', 'P+R', 'bereikbaarheid', 'verkeer', 'mobiliteit', 'fietspad',
  ],
  GROEN_KLIMAAT: [
    'park', 'groen', 'bomen', 'duurzaamheid', 'energietransitie', 'warmtenet',
    'circulair', 'CO2', 'klimaatadaptatie', 'zonnepanelen', 'isolatie', 'windenergie',
    'duurzaam', 'milieu', 'stadsnatuur', 'klimaat', 'energie', 'afval', 'recycling',
  ],
  VEILIGHEID: [
    'politie', 'handhaving', 'overlast', 'criminaliteit', 'drugs', 'ondermijning',
    'cameratoezicht', 'wijkagent', 'veiligheidsgevoel', 'huiselijk geweld',
    'radicalisering', 'BOA', 'veiligheid',
  ],
  ONDERWIJS: [
    'school', 'basisonderwijs', 'voortgezet', 'kinderopvang', 'leerplicht',
    'passend onderwijs', 'schooluitval', 'taalonderwijs', 'onderwijskwaliteit',
    'huiswerkbegeleiding', 'brede school', 'NT2', 'onderwijs', 'leraar',
  ],
  CULTUUR_SPORT: [
    'museum', 'theater', 'kunst', 'erfgoed', 'bibliotheek', 'nachtleven',
    'festivals', 'cultuursubsidie', 'cultuureducatie', 'makers', 'broedplaats',
    'muziek', 'film', 'podiumkunst', 'cultuur', 'sport', 'sporthal', 'zwembad',
  ],
  SOCIAAL: [
    'armoede', 'bijstand', 'schulden', 'WMO', 'participatie', 'integratie',
    'eenzaamheid', 'minima', 'mantelzorg', 'sociaal wijkteam', 'statushouders',
    'inburgering', 'dakloosheid', 'maatschappelijke opvang', 'sociaal',
  ],
  ECONOMIE: [
    'ondernemers', 'MKB', 'horeca', 'toerisme', 'detailhandel', 'werkgelegenheid',
    'winkelgebied', 'markt', 'startup', 'bedrijventerrein', 'vestigingsklimaat',
    'ZZP', 'koopzondag', 'economie',
  ],
  JEUGD: [
    'jeugdzorg', 'jongeren', 'speeltuinen', 'kinderen', 'jeugdparticipatie',
    'leerlingenvervoer', 'kindermishandeling', 'jongerenwerk', 'skatepark',
    'jeugdoverlast', 'pleegzorg', 'jeugd', 'jeugdhulp',
  ],
  OPENBARE_RUIMTE: [
    'straten', 'afval', 'schoonmaak', 'onderhoud', 'riolering', 'verlichting',
    'openbare toiletten', 'bankjes', 'hondenbeleid', 'graffiti', 'containertuintjes',
    'stoeptegels', 'beeldkwaliteit', 'straat', 'plein', 'gracht', 'brug', 'kade',
  ],
  FINANCIEN: [
    'begroting', 'OZB', 'belasting', 'gemeentefonds', 'bezuiniging', 'woonlasten',
    'reserves', 'subsidie', 'financieel beleid', 'rioolheffing',
    'afvalstoffenheffing', 'precariobelasting', 'financien',
  ],
  BESTUUR: [
    'participatie', 'referendum', 'burgerbegroting', 'transparantie', 'wijkraden',
    'inspraak', 'raadsenquête', 'rekenkamer', 'ombudsman', 'bestuurlijke vernieuwing',
    'ambtenaren', 'dienstverlening', 'democratie', 'bestuur',
  ],
  DIVERSITEIT: [
    'discriminatie', 'inclusie', 'diversiteit', 'toegankelijkheid', 'lhbti',
    'antiracisme', 'gelijkheid', 'emancipatie', 'beschermd wonen',
  ],
};

// ─── Parliament → City Name Mapping ────────────────────────────

const PARLIAMENT_CITY_NAMES: Record<string, string> = {
  'amsterdam-gemeente': 'Amsterdam',
  'amsterdam': 'Amsterdam',
  'den-haag-gemeente': 'Den Haag',
  'den-haag': 'Den Haag',
};

// ─── Municipal LLM Prompt ───────────────────────────────────────

function buildMunicipalMatchPrompt(
  promise: { text: string; summary: string; theme: string; partyAbbr: string },
  motions: Array<{ index: number; title: string; text: string }>,
  cityName: string,
): string {
  const motionBlock = motions
    .map((m) => `--- MOTIE ${m.index} ---\nTitel: ${m.title}\nBeschrijving: ${m.text?.slice(0, 600) || '(geen beschrijving)'}`)
    .join('\n\n');

  return `Je bent een neutrale politieke analist voor CivicStat. Je analyseert de gemeenteraad van ${cityName}.

CONTEXT:
Deze belofte komt uit het verkiezingsprogramma 2026 van ${promise.partyAbbr} voor de gemeenteraadsverkiezingen van ${cityName}. De moties hieronder zijn uit de raadsperiode 2022-2026. Je beoordeelt of de partij — op basis van wat zij nu belooft voor 2026 — consistent stemde op deze eerdere raadsmoties.

BELOFTE (verkiezingsprogramma 2026):
Tekst: ${promise.text}
Samenvatting: ${promise.summary}
Thema: ${promise.theme}

RAADSMOTIES (2022-2026):
${motionBlock}

BEOORDELINGSREGELS:
- EXPLICIT: De motie gaat DIRECT over hetzelfde onderwerp als de belofte EN vraagt om een concrete actie die de belofte zou vervullen of blokkeren. Wees STRIKT: alleen EXPLICIT als er een duidelijk, direct verband is.
- IMPLICIT: De motie raakt het thema van de belofte, maar is niet een directe uitvoering of blokkering ervan.
- CONTRADICTS: De motie vraagt om het TEGENOVERGESTELDE van wat de belofte beoogt.
- NO_MATCH: Geen inhoudelijk verband met de belofte.
- predictedDirection: Zou ${promise.partyAbbr} op basis van deze belofte VOOR of TEGEN deze raadsmotie stemmen? Gebruik "VOOR" of "TEGEN".
- confidence: Een getal tussen 0.0 en 1.0 dat aangeeft hoe zeker je bent over de match.

Antwoord ALLEEN met een valid JSON array, geen uitleg:
[
  {
    "motionIndex": 0,
    "matchType": "EXPLICIT|IMPLICIT|CONTRADICTS|NO_MATCH",
    "confidence": 0.0,
    "predictedDirection": "VOOR|TEGEN",
    "matchReason": "Korte uitleg in het Nederlands (max 100 woorden)"
  }
]

Geef een element voor ELKE motie (${motions.length} items). Wees streng met EXPLICIT — gebruik dit alleen bij een duidelijk, direct verband.`;
}

// ─── Match Type Mapping ─────────────────────────────────────────

const MATCH_TYPE_MAP: Record<string, PromiseMatchType> = {
  EXPLICIT: 'EXPLICIT_MATCH' as PromiseMatchType,
  IMPLICIT: 'IMPLICIT_MATCH' as PromiseMatchType,
  CONTRADICTS: 'CONTRADICTS' as PromiseMatchType,
};

// ─── Pre-filter: Find Candidate Motions ─────────────────────────

async function findCandidateMotions(
  promise: { text: string; summary: string; keywords: string[]; theme: string },
  parliamentId: string,
): Promise<Array<{ id: string; title: string; text: string | null; soort: string | null }>> {
  const searchTerms = new Set<string>();

  // Add promise keywords
  for (const kw of promise.keywords) {
    if (kw.length >= 3) searchTerms.add(kw.toLowerCase());
  }

  // Add municipal theme keywords
  const themeKws = MUNICIPAL_THEME_KEYWORDS[promise.theme] || [];
  for (const tkw of themeKws) searchTerms.add(tkw.toLowerCase());

  if (searchTerms.size === 0) return [];

  // Build OR conditions for keyword search
  const terms = Array.from(searchTerms);
  const orConditions = terms.flatMap((term) => [
    { title: { contains: term, mode: 'insensitive' as const } },
    { text: { contains: term, mode: 'insensitive' as const } },
  ]);

  const candidates = await prisma.motion.findMany({
    where: {
      AND: [
        { OR: orConditions },
        { parliamentId }, // CRITICAL: parliament scoping
      ],
    },
    select: { id: true, title: true, text: true, soort: true },
    take: MAX_CANDIDATES * 3,
  });

  // Filter procedural motions
  const filtered = candidates.filter((motion) => {
    const result = shouldMatchMotion({
      title: motion.title,
      description: motion.text || undefined,
      soort: motion.soort,
    });
    return !result.excluded;
  });

  return filtered.slice(0, MAX_CANDIDATES);
}

// ─── Parse Claude Response ──────────────────────────────────────

interface ClaudeMatchResult {
  motionIndex: number;
  matchType: string;
  confidence: number;
  predictedDirection: string;
  matchReason: string;
}

function parseClaudeResponse(responseText: string): ClaudeMatchResult[] {
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.warn(`    [WARN] Response is not an array`);
      return [];
    }
    return parsed;
  } catch (err) {
    console.warn(`    [WARN] Failed to parse response: ${(err as Error).message}`);
    console.warn(`    [WARN] Preview: ${jsonStr.slice(0, 200)}...`);
    return [];
  }
}

// ─── Main Matching Logic ────────────────────────────────────────

interface MunicipalMatchOptions {
  parliament: string;
  limit?: number;
  dryRun?: boolean;
  resume?: boolean;
  concurrency?: number;
}

export async function runMunicipalSemanticMatching(options: MunicipalMatchOptions): Promise<void> {
  const { parliament, dryRun = false, limit, resume = false, concurrency: concurrencyOpt } = options;

  // Resolve parliament — try exact slug, then strip "-gemeente" suffix
  const slugVariants = [parliament];
  if (parliament.endsWith('-gemeente')) {
    slugVariants.push(parliament.replace(/-gemeente$/, ''));
  }

  const parliamentRecord = await prisma.parliament.findFirst({
    where: { slug: { in: slugVariants } },
    select: { id: true, name: true, slug: true },
  });

  if (!parliamentRecord) {
    throw new Error(`Parliament not found: ${parliament}. Try "amsterdam", "den-haag", "amsterdam-gemeente", or "den-haag-gemeente".`);
  }

  const cityName = PARLIAMENT_CITY_NAMES[parliamentRecord.slug] || parliamentRecord.name;
  const progressFilePath = getProgressFilePath(parliamentRecord.slug);

  // Initialize AI client
  const model = getModel('semantic-match');
  let ai: AIClient | null = null;
  if (!dryRun) {
    ai = createAIClient();
  }

  // Load or initialize progress
  const progress = resume ? loadProgress(progressFilePath) : {
    processedPromiseIds: [] as string[],
    totalProcessed: 0,
    totalMatches: 0,
    totalSkipped: 0,
    matchBreakdown: { explicit: 0, implicit: 0, contradicts: 0 },
    totalApiCalls: 0,
    totalCandidates: 0,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    errors: [] as Array<{ promiseId: string; error: string; timestamp: string }>,
  };

  const processedSet = new Set(progress.processedPromiseIds);

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  MUNICIPAL SEMANTIC MATCHING — ${cityName} 2026`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  Provider: ${ai?.provider || 'dry-run'} (${ai?.baseUrl || 'n/a'})`);
  console.log(`  Model:    ${modelShortName(model)}`);
  console.log(`  Method:   ${MATCH_METHOD} (${ALGORITHM_VERSION})`);
  console.log(`  City:     ${cityName} (${parliamentRecord.slug})`);
  console.log(`  Limit:    ${limit || 'all'}`);
  console.log(`  Parallel: ${concurrencyOpt || CONCURRENCY} promises concurrently`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Resume:   ${resume} (${processedSet.size} already processed)`);
  console.log(`  Progress: ${progressFilePath}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  // 1. Load 2026 promises for this parliament
  const allPromises = await prisma.promise.findMany({
    where: {
      program: {
        parliamentId: parliamentRecord.id,
        electionYear: 2026,
        programType: 'VERKIEZINGSPROGRAMMA',
      },
    },
    include: {
      program: {
        select: {
          id: true,
          electionYear: true,
          party: { select: { abbreviation: true } },
        },
      },
      motionMatches: {
        where: { matchMethod: MATCH_METHOD },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  // Filter out already-processed (resume mode)
  const promises = resume
    ? allPromises.filter((p) => !processedSet.has(p.id))
    : allPromises;

  const totalToProcess = promises.length;
  const totalOverall = allPromises.length;

  // Count motions for this parliament
  const motionCount = await prisma.motion.count({ where: { parliamentId: parliamentRecord.id } });

  console.log(`[${timestamp()}] ${cityName}: ${totalOverall} promises (2026), ${motionCount} motions (2022-2026)`);
  console.log(`[${timestamp()}] ${totalToProcess} to process${resume ? ` (${processedSet.size} already done)` : ''}\n`);

  const startTime = Date.now();
  let sessionCreated = 0;
  let sessionApiCalls = 0;
  let sessionBreakdown = { explicit: 0, implicit: 0, contradicts: 0 };
  let promisesProcessed = 0;
  let promisesWithZeroMatches = 0;

  // ── Per-promise processing ──
  async function processPromise(promise: typeof promises[0]): Promise<void> {
    if (promise.motionMatches.length > 0 && !resume) {
      progress.totalSkipped++;
      processedSet.add(promise.id);
      progress.processedPromiseIds.push(promise.id);
      return;
    }

    const partyAbbr = promise.program.party.abbreviation;

    const candidates = await findCandidateMotions(
      {
        text: promise.text,
        summary: promise.summary,
        keywords: promise.keywords,
        theme: promise.theme,
      },
      parliamentRecord.id,
    );

    progress.totalCandidates += candidates.length;

    if (candidates.length === 0) {
      promisesWithZeroMatches++;
      processedSet.add(promise.id);
      progress.processedPromiseIds.push(promise.id);
      progress.totalProcessed++;
      return;
    }

    if (dryRun) {
      console.log(`  [${promise.promiseCode}] (${promise.theme}) ${candidates.length} candidates — "${promise.summary.slice(0, 60)}..."`);
      processedSet.add(promise.id);
      progress.processedPromiseIds.push(promise.id);
      progress.totalProcessed++;
      return;
    }

    // Batch candidates and call LLM
    const matchResults: Array<{
      motionId: string;
      matchType: PromiseMatchType;
      matchTypeRaw: string;
      confidence: number;
      predictedDirection: string | null;
      rationale: string;
    }> = [];

    for (let batchStart = 0; batchStart < candidates.length; batchStart += BATCH_SIZE) {
      const batch = candidates.slice(batchStart, batchStart + BATCH_SIZE);
      const motionsForPrompt = batch.map((m, i) => ({
        index: i,
        title: m.title,
        text: m.text || '',
      }));

      const prompt = buildMunicipalMatchPrompt(
        { text: promise.text, summary: promise.summary, theme: promise.theme, partyAbbr },
        motionsForPrompt,
        cityName,
      );

      try {
        const response = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
          onRetry: (attempt, delay, error) => {
            console.warn(`    [RETRY] API ${error.status}, attempt ${attempt}/3, waiting ${delay}ms...`);
          },
          traceName: 'semantic-match-municipal',
          traceTags: ['etl', 'semantic-match-municipal', parliamentRecord.slug],
        });

        sessionApiCalls++;
        progress.totalApiCalls++;

        const parsed = parseClaudeResponse(response.text);

        for (const result of parsed) {
          const { motionIndex, matchType, confidence, predictedDirection, matchReason } = result;

          if (motionIndex < 0 || motionIndex >= batch.length) continue;
          if (matchType === 'NO_MATCH' || confidence < MIN_CONFIDENCE) continue;

          const dbMatchType = MATCH_TYPE_MAP[matchType];
          if (!dbMatchType) {
            console.warn(`    [WARN] Unknown matchType "${matchType}"`);
            continue;
          }

          const direction =
            predictedDirection === 'VOOR' || predictedDirection === 'TEGEN'
              ? predictedDirection
              : null;

          matchResults.push({
            motionId: batch[motionIndex].id,
            matchType: dbMatchType,
            matchTypeRaw: matchType,
            confidence: Math.min(Math.max(confidence, 0), 1),
            predictedDirection: direction,
            rationale: matchReason || '',
          });
        }
      } catch (err) {
        const errMsg = (err as Error).message || String(err);
        console.error(`    [ERROR] API call failed for ${promise.promiseCode} batch ${batchStart}: ${errMsg}`);
        progress.errors.push({
          promiseId: promise.id,
          error: `batch ${batchStart}: ${errMsg.slice(0, 200)}`,
          timestamp: new Date().toISOString(),
        });
      }

      await sleep(RATE_LIMIT_MS);
    }

    // Upsert matches to DB
    for (const match of matchResults) {
      try {
        await prisma.promiseMotionMatch.upsert({
          where: {
            promiseId_motionId: {
              promiseId: promise.id,
              motionId: match.motionId,
            },
          },
          create: {
            promiseId: promise.id,
            motionId: match.motionId,
            matchType: match.matchType,
            confidence: match.confidence,
            rationale: match.rationale,
            matchMethod: MATCH_METHOD,
            algorithmVersion: ALGORITHM_VERSION,
            predictedDirection: match.predictedDirection,
          },
          update: {
            matchType: match.matchType,
            confidence: match.confidence,
            rationale: match.rationale,
            matchMethod: MATCH_METHOD,
            algorithmVersion: ALGORITHM_VERSION,
            predictedDirection: match.predictedDirection,
          },
        });

        sessionCreated++;
        progress.totalMatches++;

        if (match.matchTypeRaw === 'EXPLICIT') {
          sessionBreakdown.explicit++;
          progress.matchBreakdown.explicit++;
        } else if (match.matchTypeRaw === 'IMPLICIT') {
          sessionBreakdown.implicit++;
          progress.matchBreakdown.implicit++;
        } else if (match.matchTypeRaw === 'CONTRADICTS') {
          sessionBreakdown.contradicts++;
          progress.matchBreakdown.contradicts++;
        }
      } catch (err) {
        console.error(`    [ERROR] Upsert failed: promise=${promise.id} motion=${match.motionId}: ${(err as Error).message}`);
      }
    }

    if (matchResults.length === 0) promisesWithZeroMatches++;

    processedSet.add(promise.id);
    progress.processedPromiseIds.push(promise.id);
    progress.totalProcessed++;
    promisesProcessed++;

    // Save progress & log periodically
    if (promisesProcessed % PROGRESS_SAVE_INTERVAL === 0) {
      saveProgress(progress, progressFilePath);

      const elapsedMs = Date.now() - startTime;
      const avgMs = elapsedMs / promisesProcessed;
      const remainingMs = avgMs * (totalToProcess - promisesProcessed);
      const eta = formatTime(Math.round(remainingMs / 1000));
      const overallProgress = processedSet.size;
      const overallPct = totalOverall > 0 ? ((overallProgress / totalOverall) * 100).toFixed(1) : '0.0';

      console.log(
        `[${timestamp()}] Progress: ${overallProgress}/${totalOverall} (${overallPct}%) | ` +
        `Matches: ${progress.totalMatches} | ` +
        `E:${progress.matchBreakdown.explicit} I:${progress.matchBreakdown.implicit} C:${progress.matchBreakdown.contradicts} | ` +
        `Errors: ${progress.errors.length} | ` +
        `API: ${progress.totalApiCalls} | ` +
        `ETA: ~${eta}`
      );
    }
  }

  // ── Run with concurrency pool ──
  const concurrency = dryRun ? 1 : (concurrencyOpt || CONCURRENCY);
  console.log(`[${timestamp()}] Processing with concurrency=${concurrency}\n`);

  const pool = createPool(concurrency);
  const tasks = promises.map((promise) => pool(() => processPromise(promise)));
  await Promise.all(tasks);

  // Final save
  saveProgress(progress, progressFilePath);

  const totalDurationMs = Date.now() - startTime;
  const totalDuration = formatTime(Math.round(totalDurationMs / 1000));

  // Summary
  console.log(`\n═══ Municipal Semantic Matching Complete — ${cityName} ═══`);
  console.log(`  Total promises processed:  ${progress.totalProcessed.toLocaleString()}`);
  console.log(`  Promises skipped (already): ${progress.totalSkipped.toLocaleString()}`);
  console.log(`  Promises with 0 matches:   ${promisesWithZeroMatches.toLocaleString()}`);
  console.log(`  Total candidates evaluated: ${progress.totalCandidates.toLocaleString()}`);
  console.log(`  Total new matches created:  ${progress.totalMatches.toLocaleString()}`);
  if (progress.totalMatches > 0) {
    console.log(`    EXPLICIT:    ${progress.matchBreakdown.explicit.toLocaleString()} (${((progress.matchBreakdown.explicit / progress.totalMatches) * 100).toFixed(1)}%)`);
    console.log(`    IMPLICIT:    ${progress.matchBreakdown.implicit.toLocaleString()} (${((progress.matchBreakdown.implicit / progress.totalMatches) * 100).toFixed(1)}%)`);
    console.log(`    CONTRADICTS: ${progress.matchBreakdown.contradicts.toLocaleString()} (${((progress.matchBreakdown.contradicts / progress.totalMatches) * 100).toFixed(1)}%)`);
    const avgMatches = progress.totalProcessed > 0 ? (progress.totalMatches / progress.totalProcessed).toFixed(1) : '0';
    console.log(`  Average matches/promise:   ${avgMatches}`);
  }
  console.log(`  Model:                     ${modelShortName(model)} via ${ai?.provider || 'dry-run'}`);
  console.log(`  API calls made:            ${progress.totalApiCalls.toLocaleString()}`);
  console.log(`  Errors (logged):           ${progress.errors.length}`);
  console.log(`  Session duration:          ${totalDuration}`);
  console.log(`  Checkpoint file:           ${progressFilePath}`);
  console.log(`═════════════════════════════════════════════════════════\n`);

  await prisma.$disconnect();
}

// ─── Run for all municipal parliaments ──────────────────────────

export async function runAllMunicipalMatching(options: Omit<MunicipalMatchOptions, 'parliament'>): Promise<void> {
  const parliaments = ['amsterdam', 'den-haag'];
  for (const parliament of parliaments) {
    await runMunicipalSemanticMatching({ ...options, parliament });
  }
}
