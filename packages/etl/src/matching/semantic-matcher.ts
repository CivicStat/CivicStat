/**
 * Semantic Promise ↔ Motion Matcher using Claude API
 *
 * Replaces pure keyword matching with LLM-based semantic evaluation.
 * For each promise, finds candidate motions via keyword pre-filter,
 * then asks Claude to evaluate relevance, match type, and predicted
 * voting direction.
 *
 * Usage:
 *   npx tsx src/matching/semantic-matcher.ts                     # All promises
 *   npx tsx src/matching/semantic-matcher.ts --party VVD         # Only VVD
 *   npx tsx src/matching/semantic-matcher.ts --limit 10          # First 10 promises
 *   npx tsx src/matching/semantic-matcher.ts --dry-run           # Preview only
 *
 * Environment:
 *   ANTHROPIC_API_KEY — Required for Claude API access
 *   DATABASE_URL     — Postgres connection string
 */

import { PrismaClient, PromiseMatchType } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { shouldMatchMotion } from './motion-filter.js';

const prisma = new PrismaClient();

// ─── Configuration ──────────────────────────────────────────────

const MAX_CANDIDATES = 80;
const BATCH_SIZE = 8;
const MIN_CONFIDENCE = 0.4;
const RATE_LIMIT_MS = 500;
const MATCH_METHOD = 'semantic-claude';
const ALGORITHM_VERSION = 'semantic-claude-v1';
const MODEL = 'claude-sonnet-4-20250514';

// ─── Theme Keywords for Broad Pre-filter ────────────────────────

const THEME_KEYWORDS: Record<string, string[]> = {
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

// ─── Pre-filter: Find Candidate Motions ─────────────────────────

async function findCandidateMotions(
  promise: { text: string; summary: string; keywords: string[]; theme: string },
): Promise<Array<{ id: string; title: string; text: string | null; soort: string | null }>> {
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

  if (searchTerms.size === 0) {
    return [];
  }

  // Build OR conditions: title OR text contains at least one keyword
  const terms = Array.from(searchTerms);
  const orConditions = terms.flatMap((term) => [
    { title: { contains: term, mode: 'insensitive' as const } },
    { text: { contains: term, mode: 'insensitive' as const } },
  ]);

  const candidates = await prisma.motion.findMany({
    where: {
      OR: orConditions,
    },
    select: {
      id: true,
      title: true,
      text: true,
      soort: true,
    },
    take: MAX_CANDIDATES * 3, // Fetch extra to allow for filtering
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

// ─── Main Matching Logic ────────────────────────────────────────

interface SemanticMatchOptions {
  limit?: number;
  party?: string;
  dryRun?: boolean;
}

export async function runSemanticMatching(options: SemanticMatchOptions = {}): Promise<void> {
  const { party, dryRun = false, limit } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !dryRun) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required.');
  }

  const anthropic = dryRun ? null : new Anthropic({ apiKey });

  console.log(`[SEMANTIC] Starting semantic matching (party=${party || 'all'}, limit=${limit || 'all'}, dryRun=${dryRun})`);
  console.log(`[SEMANTIC] Model: ${MODEL}, method: ${MATCH_METHOD}, version: ${ALGORITHM_VERSION}`);

  // 1. Load promises
  const partyNames = party ? (PARTY_ALIASES[party] || [party]) : undefined;

  const promises = await prisma.promise.findMany({
    where: partyNames
      ? {
          program: {
            party: {
              abbreviation: { in: partyNames },
            },
          },
        }
      : undefined,
    include: {
      program: {
        select: {
          id: true,
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
    ...(limit ? { take: limit } : {}),
  });

  console.log(`[SEMANTIC] Found ${promises.length} promises to process`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalApiCalls = 0;
  let totalCandidates = 0;
  let promisesProcessed = 0;

  for (const promise of promises) {
    promisesProcessed++;

    // 2. Skip if already has semantic matches
    if (promise.motionMatches.length > 0) {
      totalSkipped++;
      continue;
    }

    const partyAbbr = promise.program.party.abbreviation;

    // 3. Find candidate motions via keyword pre-filter
    const candidates = await findCandidateMotions({
      text: promise.text,
      summary: promise.summary,
      keywords: promise.keywords,
      theme: promise.theme,
    });

    totalCandidates += candidates.length;

    if (candidates.length === 0) {
      if (promisesProcessed % 25 === 0 || dryRun) {
        console.log(`  [${promise.promiseCode}] No candidates found, skipping`);
      }
      continue;
    }

    if (dryRun) {
      console.log(`  [${promise.promiseCode}] (${promise.theme}) ${candidates.length} candidates — "${promise.summary.slice(0, 60)}..."`);
      continue;
    }

    // 4. Batch candidates into groups and call Claude
    const matchResults: Array<{
      motionId: string;
      matchType: PromiseMatchType;
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
        const response = await anthropic!.messages.create({
          model: MODEL,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });

        totalApiCalls++;

        const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = parseClaudeResponse(responseText);

        // 6. Process results
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
            confidence: Math.min(Math.max(confidence, 0), 1),
            predictedDirection: direction,
            rationale: matchReason || '',
          });
        }
      } catch (err) {
        console.error(`    [ERROR] Claude API call failed for ${promise.promiseCode} batch ${batchStart}: ${(err as Error).message}`);
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }

    // 8. Upsert matches to DB
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
        totalCreated++;
      } catch (err) {
        console.error(`    [ERROR] Upsert failed for promise=${promise.id} motion=${match.motionId}: ${(err as Error).message}`);
      }
    }

    // 9. Log progress
    if (promisesProcessed % 25 === 0) {
      console.log(`[SEMANTIC] Progress: ${promisesProcessed}/${promises.length} promises, ${totalCreated} matches created, ${totalApiCalls} API calls`);
    }
  }

  console.log(`\n[SEMANTIC] Complete:`);
  console.log(`  Promises processed: ${promisesProcessed}`);
  console.log(`  Promises skipped (already matched): ${totalSkipped}`);
  console.log(`  Total candidates evaluated: ${totalCandidates}`);
  console.log(`  API calls made: ${totalApiCalls}`);
  console.log(`  Matches created: ${totalCreated}`);

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
    limit: getArg('--limit') ? parseInt(getArg('--limit')!) : undefined,
    dryRun: args.includes('--dry-run'),
  }).catch((err) => {
    console.error('[SEMANTIC] Fatal error:', err);
    process.exit(1);
  });
}
