/**
 * Semantic Promise ↔ Motion Matcher
 *
 * Replaces pure keyword matching with LLM-based semantic evaluation.
 * For each promise, finds candidate motions via keyword pre-filter,
 * then asks the AI model to evaluate relevance, match type, and predicted
 * voting direction.
 *
 * Supports multiple AI providers via OpenRouter (Claude, GPT-4o, Gemini, etc.)
 * or direct Anthropic API as fallback.
 *
 * Features:
 *   - Multi-provider AI via OpenRouter or direct Anthropic
 *   - File-based checkpoint for crash recovery (--resume)
 *   - Exponential backoff on rate-limit / overloaded / timeout errors
 *   - Detailed progress logging with ETA
 *   - Match type breakdown tracking
 *   - Dry-run and limit modes
 *
 * Usage:
 *   npx tsx src/index.ts semantic-match                     # All promises
 *   npx tsx src/index.ts semantic-match --party VVD         # Only VVD
 *   npx tsx src/index.ts semantic-match --limit 20          # First 20 promises
 *   npx tsx src/index.ts semantic-match --dry-run           # Preview only
 *   npx tsx src/index.ts semantic-match --resume            # Resume from checkpoint
 *
 * Environment:
 *   OPENROUTER_API_KEY — Preferred: OpenRouter key (access to all models)
 *   ANTHROPIC_API_KEY  — Fallback: direct Anthropic API
 *   AI_MODEL_SEMANTIC_MATCH — Override model (e.g. google/gemini-2.5-pro)
 *   DATABASE_URL       — Postgres connection string
 */

import { PrismaClient } from '@prisma/client';
import type { PromiseMatchType } from '@prisma/client';
import { shouldMatchMotion } from './motion-filter.js';
import { createAIClient, chatWithRetry, getModel, modelShortName, AIError } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// ─── Configuration ──────────────────────────────────────────────

const MAX_CANDIDATES = 80;
const BATCH_SIZE = 16; // 16 motions per API call (Opus handles large context well)
const MIN_CONFIDENCE = 0.5; // Tuned: 0.40-0.49 matches are too tangential for scoring
const RATE_LIMIT_MS = 100; // minimal delay between batches (OpenRouter handles rate limiting)
const MATCH_METHOD = 'semantic-claude';
const ALGORITHM_VERSION = 'semantic-claude-v1';
const PROGRESS_SAVE_INTERVAL = 50; // save checkpoint every N promises
const CONCURRENCY = 10; // process N promises in parallel (default, overridable via --concurrency)

// ─── Progress Tracking ─────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProgressFilePath(parliamentSlug?: string): string {
  const suffix = parliamentSlug ? `-${parliamentSlug}` : '';
  return path.join(__dirname, `../../data/semantic-progress${suffix}.json`);
}

// Default for backward compatibility (used when no --parliament flag)
const PROGRESS_FILE = getProgressFilePath();

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

function loadProgressFrom(filePath: string): ProgressState {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(data) as ProgressState;
    // Ensure all fields exist (backward compat with partial checkpoint files)
    if (!state.matchBreakdown) {
      state.matchBreakdown = { explicit: 0, implicit: 0, contradicts: 0 };
    }
    if (!state.errors) {
      state.errors = [];
    }
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

function saveProgressTo(state: ProgressState, filePath: string): void {
  state.lastUpdatedAt = new Date().toISOString();
  // Ensure the directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

// Backward-compatible wrappers using default PROGRESS_FILE
function loadProgress(): ProgressState { return loadProgressFrom(PROGRESS_FILE); }
function saveProgress(state: ProgressState): void { saveProgressTo(state, PROGRESS_FILE); }

// ─── Utilities ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple concurrency limiter (like p-limit) */
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
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          active--;
          next();
        }
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

// ─── Theme Keywords for Broad Pre-filter ────────────────────────

export const THEME_KEYWORDS: Record<string, string[]> = {
  DEFENSIE: ['defensie', 'navo', 'krijgsmacht', 'militair', 'leger', 'wapen', 'veteranen', 'defensiebudget', 'defensie-uitgaven'],
  MIGRATIE: ['migratie', 'asiel', 'vluchteling', 'verblijfsvergunning', 'naturalisatie', 'arbeidsmigrant', 'inburgering', 'opvang', 'asielzoekers', 'immigratie'],
  KLIMAAT: ['klimaat', 'co2', 'emissie', 'duurzaam', 'fossiel', 'energie', 'windenergie', 'zonnepanelen', 'kernenergie', 'gas', 'klimaatneutraal', 'energietransitie', 'uitstoot'],
  WONEN: ['woning', 'huur', 'koop', 'woningbouw', 'sociale huur', 'huurder', 'huisvesting', 'bouwopgave', 'woningmarkt', 'hypotheek', 'huurprijs'],
  ZORG: ['zorg', 'zorgverzekering', 'eigen risico', 'huisarts', 'ziekenhuis', 'ggz', 'basispakket', 'premie', 'gezondheid', 'verpleging', 'medicijnen'],
  ONDERWIJS: ['onderwijs', 'school', 'leraar', 'student', 'studie', 'hoger onderwijs', 'basisonderwijs', 'leerkracht', 'collegegeld', 'mbo', 'universiteit'],
  ECONOMIE: ['minimumloon', 'belasting', 'vermogen', 'loon', 'baan', 'werk', 'inkomen', 'btw', 'arbeidsmarkt', 'economie', 'werkgelegenheid', 'ondernemers', 'mkb'],
  VEILIGHEID: ['politie', 'justitie', 'straf', 'criminaliteit', 'rechter', 'gevangenis', 'wijkagent', 'veiligheid', 'opsporing', 'handhaving', 'terrorisme'],
  LANDBOUW: ['landbouw', 'stikstof', 'boer', 'natuur', 'biodiversiteit', 'grondbank', 'veeteelt', 'mest', 'agrarisch', 'voedsel', 'boeren'],
  BESTUUR: ['democratie', 'transparantie', 'referendum', 'grondwet', 'bestuur', 'decentralisatie', 'gemeente', 'provincie', 'parlement', 'rechtsstaat'],
  BUITENLAND: ['europa', 'eu', 'internationaal', 'handels', 'buitenland', 'ontwikkelingssamenwerking', 'diplomatie', 'mensenrechten', 'wereldhandel'],
  SOCIAAL: ['armoede', 'bijstand', 'pensioen', 'aow', 'toeslagen', 'bestaanszekerheid', 'kinderbijslag', 'uitkering', 'sociaal', 'participatie', 'wmo'],
  FINANCIEN: ['begroting', 'staatsschuld', 'belastinghervorming', 'overheidsfinancien', 'bezuiniging', 'investering', 'begrotingstekort', 'financien'],
  DIGITALISERING: ['digitalisering', 'privacy', 'cybersecurity', 'kunstmatige intelligentie', 'data', 'digitaal', 'ict', 'technologie', 'online'],
  INFRASTRUCTUUR: ['infrastructuur', 'spoor', 'snelweg', 'openbaar vervoer', 'ov', 'mobiliteit', 'verkeer', 'wegen', 'fiets', 'trein'],
  CULTUUR: ['cultuur', 'kunst', 'erfgoed', 'museum', 'media', 'publieke omroep', 'bibliotheek', 'sport', 'recreatie'],
  'MEDISCHE-ETHIEK': ['euthanasie', 'abortus', 'embryo', 'orgaandonatie', 'medische ethiek', 'voltooid leven', 'stamcel', 'genetisch'],
  // ─── Municipal themes ──────────────────────
  VERKEER: ['verkeer', 'fiets', 'fietser', 'tram', 'metro', 'bus', 'parkeren', 'mobiliteit', 'ov', 'openbaar vervoer', 'autoluw', 'fietspad', 'ringweg', 'verkeersdrempel', 'bereikbaarheid'],
  GROEN_KLIMAAT: ['groen', 'park', 'bomen', 'duurzaam', 'klimaat', 'energie', 'zonnepanelen', 'warmtenet', 'afval', 'recycling', 'circulair', 'CO2', 'milieu', 'isolatie', 'energielabel', 'windmolen'],
  CULTUUR_SPORT: ['cultuur', 'kunst', 'museum', 'theater', 'sport', 'sporthal', 'zwembad', 'bibliotheek', 'festival', 'muziek', 'subsidie', 'erfgoed', 'atelier', 'poppodium'],
  JEUGD: ['jeugd', 'jongeren', 'jeugdzorg', 'speelplaats', 'speeltuin', 'kinderopvang', 'scholier', 'tiener', 'jeugdhulp', 'leerplicht', 'jongerenwerk'],
  OPENBARE_RUIMTE: ['straat', 'plein', 'stoep', 'riolering', 'water', 'gracht', 'brug', 'verlichting', 'onderhoud', 'schoon', 'containers', 'bestrating', 'kade', 'tunnel'],
  DIVERSITEIT: ['discriminatie', 'inclusie', 'diversiteit', 'toegankelijkheid', 'lhbti', 'antiracisme', 'gelijkheid', 'integratie', 'emancipatie', 'beschermd wonen'],
};

// ─── Party Aliases ──────────────────────────────────────────────

const PARTY_ALIASES: Record<string, string[]> = {
  'GL-PvdA': ['GroenLinks-PvdA', 'GL-PvdA', 'GroenLinksPvdA'],
  'GroenLinks-PvdA': ['GroenLinks-PvdA', 'GL-PvdA', 'GroenLinksPvdA'],
  'PVV': ['PVV', 'Partij voor de Vrijheid'],
  'NSC': ['NSC', 'Nieuw Sociaal Contract'],
  'BBB': ['BBB', 'BoerBurgerBeweging'],
};

// ─── Claude Prompt (Dutch) ──────────────────────────────────────

function buildMatchPrompt(
  promise: { text: string; summary: string; theme: string; partyAbbr: string },
  motions: Array<{ index: number; title: string; text: string }>,
): string {
  const motionBlock = motions
    .map((m) => `--- MOTIE ${m.index} ---\nTitel: ${m.title}\nBeschrijving: ${m.text?.slice(0, 600) || '(geen beschrijving)'}`)
    .join('\n\n');

  return `Je bent een neutrale politieke analist voor CivicStat. Beoordeel of de onderstaande moties relevant zijn voor de verkiezingsbelofte van ${promise.partyAbbr}.

BELOFTE:
Tekst: ${promise.text}
Samenvatting: ${promise.summary}
Thema: ${promise.theme}

MOTIES:
${motionBlock}

BEOORDELINGSREGELS:
- EXPLICIT: De motie gaat DIRECT over hetzelfde onderwerp als de belofte EN vraagt om een concrete actie die de belofte zou vervullen of blokkeren. Wees STRIKT: alleen EXPLICIT als er een duidelijk, direct verband is.
- IMPLICIT: De motie raakt het thema van de belofte, maar is niet een directe uitvoering of blokkering ervan.
- CONTRADICTS: De motie vraagt om het TEGENOVERGESTELDE van wat de belofte beoogt.
- NO_MATCH: Geen inhoudelijk verband met de belofte.
- predictedDirection: Zou de partij (${promise.partyAbbr}) op basis van deze belofte VOOR of TEGEN deze motie stemmen? Gebruik "VOOR" of "TEGEN".
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

// ─── Embedding-based Candidate Search ───────────────────────────

/**
 * Find candidate motions using pgvector cosine similarity.
 * Falls back to keyword search if embeddings are not available.
 */
async function findCandidatesByEmbedding(
  promiseText: string,
  parliamentId?: string,
  topK: number = MAX_CANDIDATES,
): Promise<Array<{ id: string; title: string; text: string; soort: string | null; similarity: number }>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  const model = process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small';

  try {
    // Generate embedding for the promise text
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://civicstat.nl',
        'X-Title': 'CivicStat ETL',
      },
      body: JSON.stringify({
        model,
        input: [promiseText.slice(0, 8000)],
        dimensions: 1536,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json() as any;
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) return [];

    const vecStr = `[${embedding.join(',')}]`;
    const parliamentFilter = parliamentId ? `AND m.parliament_id = '${parliamentId}'` : '';

    // Cosine similarity search using pgvector
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; text: string; soort: string | null; similarity: number }>
    >(
      `SELECT m.id, m.title, m.text, m.soort,
              1 - (m.embedding <=> $1::vector) as similarity
       FROM motions m
       WHERE m.embedding IS NOT NULL ${parliamentFilter}
       ORDER BY m.embedding <=> $1::vector
       LIMIT $2`,
      vecStr,
      topK,
    );

    return rows;
  } catch {
    // Silently fall back to keyword search if embedding search fails
    return [];
  }
}

// ─── Pre-filter: Find Candidate Motions ─────────────────────────

async function findCandidateMotions(
  promise: { text: string; summary: string; keywords: string[]; theme: string },
  parliamentId?: string,
): Promise<Array<{ id: string; title: string; text: string | null; soort: string | null }>> {
  // Try embedding-based search first (if motions have embeddings)
  const embeddingCandidates = await findCandidatesByEmbedding(
    `${promise.summary}\n${promise.text}`,
    parliamentId,
    MAX_CANDIDATES,
  );

  // Build search terms: promise keywords + theme-level keywords
  const searchTerms = new Set<string>();

  // Add promise keywords
  for (const kw of promise.keywords) {
    if (kw.length >= 3) {
      searchTerms.add(kw.toLowerCase());
    }
  }

  // Add theme keywords
  const themeKws = THEME_KEYWORDS[promise.theme] || [];
  for (const tkw of themeKws) {
    searchTerms.add(tkw.toLowerCase());
  }

  let keywordCandidates: Array<{ id: string; title: string; text: string | null; soort: string | null }> = [];

  if (searchTerms.size > 0) {
    // Build OR conditions: title OR text contains at least one keyword
    const terms = Array.from(searchTerms);
    const orConditions = terms.flatMap((term) => [
      { title: { contains: term, mode: 'insensitive' as const } },
      { text: { contains: term, mode: 'insensitive' as const } },
    ]);

    keywordCandidates = await prisma.motion.findMany({
      where: {
        AND: [
          { OR: orConditions },
          ...(parliamentId ? [{ parliamentId }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        text: true,
        soort: true,
      },
      take: MAX_CANDIDATES * 3, // Fetch extra to allow for filtering
    });
  }

  // Merge: embedding candidates (high-quality) + keyword candidates (recall)
  const seenIds = new Set<string>();
  const merged: Array<{ id: string; title: string; text: string | null; soort: string | null }> = [];

  // Embedding results first (ranked by similarity)
  for (const c of embeddingCandidates) {
    if (c.similarity >= 0.3) { // minimum similarity threshold
      seenIds.add(c.id);
      merged.push({ id: c.id, title: c.title, text: c.text, soort: c.soort });
    }
  }

  // Then keyword results for additional recall
  for (const c of keywordCandidates) {
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      merged.push(c);
    }
  }

  // Filter procedural motions
  const filtered = merged.filter((motion) => {
    const result = shouldMatchMotion({
      title: motion.title,
      description: motion.text || undefined,
      soort: motion.soort,
    });
    return !result.excluded;
  });

  // Cap at MAX_CANDIDATES
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

  // Strip markdown code fences if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.warn(`    [WARN] Claude response is not an array`);
      return [];
    }
    return parsed;
  } catch (err) {
    console.warn(`    [WARN] Failed to parse Claude response as JSON: ${(err as Error).message}`);
    console.warn(`    [WARN] Response preview: ${jsonStr.slice(0, 200)}...`);
    return [];
  }
}

// ─── API Call with Exponential Backoff ───────────────────────────
// Now uses the unified AI client (OpenRouter or direct Anthropic)

// ─── Main Matching Logic ────────────────────────────────────────

interface SemanticMatchOptions {
  limit?: number;
  party?: string;
  parliament?: string;
  dryRun?: boolean;
  resume?: boolean;
  concurrency?: number;
}

export async function runSemanticMatching(options: SemanticMatchOptions = {}): Promise<void> {
  const { party, parliament, dryRun = false, limit, resume = false, concurrency: concurrencyOpt } = options;

  // Resolve parliament if specified
  let parliamentRecord: { id: string; name: string; slug: string } | null = null;
  if (parliament) {
    parliamentRecord = await prisma.parliament.findUnique({
      where: { slug: parliament },
      select: { id: true, name: true, slug: true },
    });
    if (!parliamentRecord) {
      throw new Error(`Parliament not found: ${parliament}. Use slug like "amsterdam", "den-haag", or "tweede-kamer".`);
    }
    console.log(`🏛  Scoped to parliament: ${parliamentRecord.name} (${parliamentRecord.slug})`);
  }

  // Use parliament-specific progress file
  const progressFilePath = getProgressFilePath(parliament);

  // Initialize AI client (OpenRouter or direct Anthropic)
  const model = getModel('semantic-match');
  let ai: AIClient | null = null;
  if (!dryRun) {
    ai = createAIClient();
  }

  // Load or initialize progress (from parliament-specific file)
  const progress = resume ? loadProgressFrom(progressFilePath) : {
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
  console.log(`  SEMANTIC MATCHING — CivicStat`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  Provider: ${ai?.provider || 'dry-run'} (${ai?.baseUrl || 'n/a'})`);
  console.log(`  Model:    ${modelShortName(model)}`);
  console.log(`  Method:   ${MATCH_METHOD} (${ALGORITHM_VERSION})`);
  console.log(`  Parliamt: ${parliamentRecord?.name || 'all (global)'}`);
  console.log(`  Party:    ${party || 'all'}`);
  console.log(`  Limit:    ${limit || 'all'}`);
  console.log(`  Parallel: ${concurrencyOpt || CONCURRENCY} promises concurrently`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Resume:   ${resume} (${processedSet.size} already processed)`);
  console.log(`  Progress: ${progressFilePath}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  // 1. Load promises
  const partyNames = party ? (PARTY_ALIASES[party] || [party]) : undefined;

  const promiseWhere: any = {};
  if (partyNames) {
    promiseWhere.program = { ...promiseWhere.program, party: { abbreviation: { in: partyNames } } };
  }
  if (parliamentRecord) {
    promiseWhere.program = { ...promiseWhere.program, parliamentId: parliamentRecord.id };
  }

  const allPromises = await prisma.promise.findMany({
    where: Object.keys(promiseWhere).length > 0 ? promiseWhere : undefined,
    include: {
      program: {
        select: {
          id: true,
          electionYear: true,
          party: {
            select: {
              abbreviation: true,
            },
          },
        },
      },
      motionMatches: {
        where: {
          matchMethod: MATCH_METHOD,
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  // Filter out already-processed promises (resume mode)
  const promises = resume
    ? allPromises.filter((p) => !processedSet.has(p.id))
    : allPromises;

  const totalToProcess = promises.length;
  const totalOverall = allPromises.length;

  console.log(`[${timestamp()}] Found ${totalOverall} total promises, ${totalToProcess} to process${resume ? ` (${processedSet.size} already done)` : ''}\n`);

  const startTime = Date.now();
  let sessionCreated = 0;
  let sessionApiCalls = 0;
  let sessionBreakdown = { explicit: 0, implicit: 0, contradicts: 0 };
  let promisesProcessed = 0;
  let promisesWithZeroMatches = 0;

  // ── Per-promise processing function ──
  async function processPromise(promise: typeof promises[0]): Promise<void> {
    // Skip if already has semantic matches (not resume — just already in DB from prior run)
    if (promise.motionMatches.length > 0 && !resume) {
      progress.totalSkipped++;
      processedSet.add(promise.id);
      progress.processedPromiseIds.push(promise.id);
      return;
    }

    const partyAbbr = promise.program.party.abbreviation;

    // Find candidate motions via keyword pre-filter
    const candidates = await findCandidateMotions(
      {
        text: promise.text,
        summary: promise.summary,
        keywords: promise.keywords,
        theme: promise.theme,
      },
      parliamentRecord?.id,
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

    // Batch candidates into groups and call Claude
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

      const prompt = buildMatchPrompt(
        {
          text: promise.text,
          summary: promise.summary,
          theme: promise.theme,
          partyAbbr,
        },
        motionsForPrompt,
      );

      try {
        const response = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
          onRetry: (attempt, delay, error) => {
            console.warn(`    [RETRY] API ${error.status} (${error.message.slice(0, 80)}), attempt ${attempt}/3, waiting ${delay}ms...`);
          },
          traceName: 'semantic-match',
          traceTags: ['etl', 'semantic-match'],
        });

        sessionApiCalls++;
        progress.totalApiCalls++;

        const responseText = response.text;
        const parsed = parseClaudeResponse(responseText);

        // Process results
        for (const result of parsed) {
          const { motionIndex, matchType, confidence, predictedDirection, matchReason } = result;

          // Validate motionIndex
          if (motionIndex < 0 || motionIndex >= batch.length) {
            continue;
          }

          // Skip NO_MATCH or low confidence
          if (matchType === 'NO_MATCH' || confidence < MIN_CONFIDENCE) {
            continue;
          }

          // Map match type
          const dbMatchType = MATCH_TYPE_MAP[matchType];
          if (!dbMatchType) {
            console.warn(`    [WARN] Unknown matchType "${matchType}", skipping`);
            continue;
          }

          // Validate predictedDirection
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
        console.error(`    [ERROR] AI API call failed for ${promise.promiseCode} batch ${batchStart}: ${errMsg}`);
        progress.errors.push({
          promiseId: promise.id,
          error: `batch ${batchStart}: ${errMsg.slice(0, 200)}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Rate limiting between batches within a single promise
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

        // Track breakdown
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
        console.error(`    [ERROR] Upsert failed for promise=${promise.id} motion=${match.motionId}: ${(err as Error).message}`);
      }
    }

    if (matchResults.length === 0) {
      promisesWithZeroMatches++;
    }

    // Mark as processed
    processedSet.add(promise.id);
    progress.processedPromiseIds.push(promise.id);
    progress.totalProcessed++;
    promisesProcessed++;

    // Save progress & log periodically
    if (promisesProcessed % PROGRESS_SAVE_INTERVAL === 0) {
      saveProgressTo(progress, progressFilePath);

      // Calculate ETA
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
  saveProgressTo(progress, progressFilePath);

  // Calculate duration
  const totalDurationMs = Date.now() - startTime;
  const totalDuration = formatTime(Math.round(totalDurationMs / 1000));

  // Summary
  console.log(`\n═══ Semantic Matching Complete ═══`);
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
  console.log(`═════════════════════════════════\n`);

  await prisma.$disconnect();
}

// ─── CLI Entry Point ────────────────────────────────────────────

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('semantic-matcher.ts')
) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  runSemanticMatching({
    party: getArg('--party'),
    parliament: getArg('--parliament'),
    limit: getArg('--limit') ? parseInt(getArg('--limit')!) : undefined,
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
    concurrency: getArg('--concurrency') ? parseInt(getArg('--concurrency')!) : undefined,
  }).catch((err) => {
    console.error('[SEMANTIC] Fatal error:', err);
    process.exit(1);
  });
}
