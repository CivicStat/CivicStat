/**
 * Promise ↔ Motion Keyword Matcher
 *
 * Matches promises to motions by extracting keywords from both the
 * promise text/summary and the motion title/text, then scoring overlap.
 *
 * Algorithm (keyword-overlap-v1):
 * 1. Extract meaningful keywords from promise text + summary
 * 2. For each motion, extract keywords from title + text
 * 3. Score by weighted keyword overlap (exact > stem > partial)
 * 4. Store matches above threshold with rationale
 *
 * Usage:
 *   npx tsx src/matching/promise-motion-matcher.ts                     # All promises
 *   npx tsx src/matching/promise-motion-matcher.ts --party VVD         # Only VVD
 *   npx tsx src/matching/promise-motion-matcher.ts --party GL-PvdA     # Only GL-PvdA
 *   npx tsx src/matching/promise-motion-matcher.ts --dry-run           # Preview only
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Configuration ──────────────────────────────────────────
const MATCH_THRESHOLD = 0.15;  // Minimum score to create a match
const MAX_MATCHES_PER_PROMISE = 15;  // Cap matches per promise
const ALGORITHM_VERSION = 'keyword-overlap-v1';

// ─── Dutch Stop Words ───────────────────────────────────────
const STOP_WORDS = new Set([
  'de', 'het', 'een', 'der', 'des', 'den',
  'ik', 'je', 'jij', 'u', 'hij', 'zij', 'ze', 'wij', 'we', 'jullie',
  'mij', 'jou', 'hem', 'haar', 'ons', 'hen', 'hun', 'zich',
  'dit', 'dat', 'deze', 'die', 'welke', 'wat', 'wie', 'waar',
  'in', 'op', 'aan', 'van', 'voor', 'met', 'door', 'om', 'bij',
  'naar', 'uit', 'over', 'tot', 'na', 'onder', 'tegen', 'tussen',
  'zonder', 'binnen', 'buiten', 'tijdens', 'sinds', 'volgens',
  'en', 'of', 'maar', 'want', 'dus', 'omdat', 'dat', 'als', 'dan',
  'toen', 'terwijl', 'hoewel', 'indien', 'tenzij', 'zodat', 'noch',
  'is', 'zijn', 'was', 'waren', 'wordt', 'worden', 'werd', 'werden',
  'heeft', 'hebben', 'had', 'hadden', 'kan', 'kunnen', 'kon', 'konden',
  'zal', 'zullen', 'zou', 'zouden', 'moet', 'moeten', 'mag', 'mogen',
  'wil', 'willen', 'gaat', 'gaan', 'ging', 'gingen', 'komt', 'komen',
  'kwam', 'kwamen', 'doet', 'doen', 'deed', 'deden', 'laat', 'laten',
  'ook', 'nog', 'al', 'er', 'zo', 'meer', 'veel', 'niet', 'geen',
  'wel', 'heel', 'zeer', 'dan', 'toch', 'alleen', 'ander', 'andere',
  'elk', 'elke', 'ieder', 'iedere', 'alle', 'alles', 'enige',
  // Parliamentary boilerplate
  'kamer', 'gehoord', 'beraadslaging', 'constaterende', 'overwegende',
  'verzoekt', 'regering', 'orde', 'dag', 'motie', 'voorstel', 'spreekt',
  'ingediend', 'lid', 'leden', 'fractie', 'kamerlid', 'minister',
  'staatssecretaris', 'kabinet', 'coalitie', 'oppositie',
]);

// ─── Theme-specific boost keywords ─────────────────────────
// Keywords that strongly indicate a match to a specific theme
const THEME_KEYWORDS: Record<string, string[]> = {
  DEFENSIE: ['defensie', 'navo', 'krijgsmacht', 'militair', 'leger', 'wapen', 'veiligheid'],
  KLIMAAT: ['klimaat', 'co2', 'emissie', 'duurzaam', 'fossiel', 'energie', 'wind', 'zon', 'kerncentrale', 'gas', 'klimaatneutraal'],
  WONEN: ['woning', 'huur', 'koop', 'woningbouw', 'sociale huur', 'huurder', 'huisvesting', 'bouwopgave'],
  MIGRATIE: ['migratie', 'asiel', 'vluchteling', 'verblijfsvergunning', 'naturalisatie', 'arbeidsmigrant', 'inburgering'],
  ZORG: ['zorg', 'zorgverzekering', 'eigen risico', 'huisarts', 'ziekenhuis', 'ggz', 'basispakket', 'premie'],
  ECONOMIE: ['minimumloon', 'belasting', 'vermogen', 'loon', 'baan', 'werk', 'inkomen', 'btw', 'arbeidsmarkt'],
  VEILIGHEID: ['politie', 'justitie', 'straf', 'criminaliteit', 'rechter', 'gevangenis', 'wijkagent'],
  LANDBOUW: ['landbouw', 'stikstof', 'boer', 'natuur', 'biodiversiteit', 'grondbank', 'veeteelt', 'mest'],
  ONDERWIJS: ['onderwijs', 'school', 'leraar', 'student', 'studie', 'hoger onderwijs', 'basisonderwijs'],
  BESTUUR: ['democratie', 'transparantie', 'referendum', 'grondwet', 'bestuur', 'decentralisatie'],
  BUITENLAND: ['europa', 'eu', 'internationaal', 'handels', 'buitenland', 'ontwikkelingssamenwerking'],
  SOCIAAL: ['armoede', 'bijstand', 'pensioen', 'aow', 'toeslagen', 'bestaanszekerheid', 'kinderbijslag'],
};

// ─── Keyword Extraction ─────────────────────────────────────
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sàáâãäéèêëíìîïóòôõöúùûüñç€%-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function extractBigrams(words: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

// ─── Scoring ────────────────────────────────────────────────
function scoreMatch(
  promiseKeywords: Set<string>,
  promiseBigrams: Set<string>,
  motionKeywords: Set<string>,
  motionBigrams: Set<string>,
  theme: string,
): { score: number; matchedTerms: string[] } {
  const matchedTerms: string[] = [];
  let score = 0;

  // Bigram matches (worth more — compound concepts like "sociale huur")
  for (const bg of promiseBigrams) {
    if (motionBigrams.has(bg)) {
      score += 3;
      matchedTerms.push(`"${bg}"`);
    }
  }

  // Single keyword matches
  for (const kw of promiseKeywords) {
    if (motionKeywords.has(kw)) {
      score += 1;
      matchedTerms.push(kw);
    }
  }

  // Theme keyword boost — if motion contains theme keywords, small bonus
  const themeKws = THEME_KEYWORDS[theme] || [];
  for (const tkw of themeKws) {
    if (motionKeywords.has(tkw) || [...motionBigrams].some(bg => bg.includes(tkw))) {
      score += 0.5;
    }
  }

  // Normalize by promise keyword count to avoid bias toward long promises
  const normalizedScore = promiseKeywords.size > 0
    ? score / Math.sqrt(promiseKeywords.size)
    : 0;

  return { score: normalizedScore, matchedTerms: [...new Set(matchedTerms)] };
}

// ─── Main Matching Logic ────────────────────────────────────
interface MatchOptions {
  party?: string;
  dryRun?: boolean;
  limit?: number;
}

export async function matchPromisesToMotions(options: MatchOptions = {}): Promise<void> {
  const { party, dryRun = false, limit } = options;
  console.log(`[MATCH] Starting promise-motion matching (party=${party || 'all'}, dryRun=${dryRun})...`);

  // 1. Fetch promises with their party info
  const partyAliases: Record<string, string[]> = {
    'GL-PvdA': ['GroenLinks-PvdA', 'GL-PvdA', 'GroenLinksPvdA'],
    'GroenLinks-PvdA': ['GroenLinks-PvdA', 'GL-PvdA', 'GroenLinksPvdA'],
    'PVV': ['PVV', 'Partij voor de Vrijheid'],
    'NSC': ['NSC', 'Nieuw Sociaal Contract'],
    'BBB': ['BBB', 'BoerBurgerBeweging'],
  };
  const partyNames = party ? (partyAliases[party] || [party]) : undefined;

  const promises = await prisma.promise.findMany({
    where: partyNames ? {
      program: {
        party: {
          abbreviation: { in: partyNames },
        },
      },
    } : undefined,
    include: {
      program: {
        include: { party: true },
      },
    },
  });

  console.log(`[MATCH] Found ${promises.length} promises to match`);

  // 2. Fetch all motions (we'll batch-process)
  const motionCount = await prisma.motion.count();
  console.log(`[MATCH] Scoring against ${motionCount} motions...`);

  const BATCH_SIZE = 1000;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const promise of promises) {
    const promiseWords = extractKeywords(`${promise.text} ${promise.summary}`);
    const promiseKeywordSet = new Set(promiseWords);
    const promiseBigramSet = new Set(extractBigrams(promiseWords));

    const matches: Array<{ motionId: string; score: number; matchedTerms: string[] }> = [];

    // Process motions in batches
    let offset = 0;
    while (true) {
      const motions = await prisma.motion.findMany({
        skip: offset,
        take: BATCH_SIZE,
        select: { id: true, title: true, text: true },
      });
      if (motions.length === 0) break;

      for (const motion of motions) {
        const motionText = `${motion.title || ''} ${motion.text || ''}`;
        const motionWords = extractKeywords(motionText);
        const motionKeywordSet = new Set(motionWords);
        const motionBigramSet = new Set(extractBigrams(motionWords));

        const { score, matchedTerms } = scoreMatch(
          promiseKeywordSet,
          promiseBigramSet,
          motionKeywordSet,
          motionBigramSet,
          promise.theme,
        );

        if (score >= MATCH_THRESHOLD && matchedTerms.length >= 2) {
          matches.push({ motionId: motion.id, score, matchedTerms });
        }
      }

      offset += BATCH_SIZE;
      if (limit && offset >= limit) break;
    }

    // Sort by score descending, take top N
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, MAX_MATCHES_PER_PROMISE);

    if (dryRun) {
      console.log(`\n[MATCH] ${promise.promiseCode} (${promise.theme}): ${topMatches.length} matches (of ${matches.length} above threshold)`);
      for (const m of topMatches.slice(0, 5)) {
        console.log(`  → score=${m.score.toFixed(2)} terms=[${m.matchedTerms.slice(0, 5).join(', ')}]`);
      }
    } else {
      // Delete existing matches for this promise with same algorithm version
      await prisma.promiseMotionMatch.deleteMany({
        where: {
          promiseId: promise.id,
          matchMethod: ALGORITHM_VERSION,
        },
      });

      // Create new matches
      if (topMatches.length > 0) {
        await prisma.promiseMotionMatch.createMany({
          data: topMatches.map(m => ({
            promiseId: promise.id,
            motionId: m.motionId,
            matchType: 'IMPLICIT_MATCH' as any,
            confidence: Math.min(m.score / 2, 1), // Normalize to 0-1
            rationale: `Matched keywords: ${m.matchedTerms.slice(0, 10).join(', ')}`,
            matchMethod: ALGORITHM_VERSION,
            algorithmVersion: ALGORITHM_VERSION,
          })),
          skipDuplicates: true,
        });
      }

      totalCreated += topMatches.length;
      console.log(`[MATCH] ✅ ${promise.promiseCode}: ${topMatches.length} matches created`);
    }
  }

  if (!dryRun) {
    console.log(`\n[MATCH] ✅ Complete: ${totalCreated} matches created, ${totalSkipped} skipped`);
  }

  await prisma.$disconnect();
}

// ─── CLI entry point ────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('promise-motion-matcher.ts')) {
  const args = process.argv.slice(2);
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;

  matchPromisesToMotions({
    party: partyArg,
    dryRun,
    limit: limitArg ? parseInt(limitArg) : undefined,
  }).catch(console.error);
}
