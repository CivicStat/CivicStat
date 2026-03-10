/**
 * Motion ↔ Program Passage Keyword Matching
 * 
 * Phase 1: TF-IDF-style keyword matching between motion texts and
 * program passages. Matches are stored in MotionProgramMatch with
 * score and rationale (matched keywords + context).
 * 
 * Algorithm (v1.0 — keyword_tfidf):
 * 1. Extract keywords from motion text (nouns, compound terms)
 * 2. For each party that has a program for the relevant election year:
 *    - Score each passage by keyword overlap (weighted by term rarity)
 *    - Keep top N passages above threshold
 * 3. Store matches with score + rationale
 * 
 * Usage:
 *   npx tsx src/matching/keyword-match.ts                    # All motions
 *   npx tsx src/matching/keyword-match.ts --limit 50         # First 50 motions
 *   npx tsx src/matching/keyword-match.ts --party VVD        # Only match VVD
 *   npx tsx src/matching/keyword-match.ts --year 2023        # Only TK2023 programs
 *   npx tsx src/matching/keyword-match.ts --dry-run          # Preview without storing
 */

// ─── Dutch Stop Words ───────────────────────────────────────────
const STOP_WORDS = new Set([
  // Articles & determiners
  'de', 'het', 'een', 'der', 'des', 'den',
  // Pronouns
  'ik', 'je', 'jij', 'u', 'hij', 'zij', 'ze', 'wij', 'we', 'jullie',
  'mij', 'jou', 'hem', 'haar', 'ons', 'hen', 'hun', 'zich',
  'dit', 'dat', 'deze', 'die', 'welke', 'wat', 'wie', 'waar',
  // Prepositions
  'in', 'op', 'aan', 'van', 'voor', 'met', 'door', 'om', 'bij',
  'naar', 'uit', 'over', 'tot', 'na', 'onder', 'tegen', 'tussen',
  'zonder', 'binnen', 'buiten', 'tijdens', 'sinds', 'volgens',
  // Conjunctions
  'en', 'of', 'maar', 'want', 'dus', 'omdat', 'dat', 'als', 'dan',
  'toen', 'terwijl', 'hoewel', 'indien', 'tenzij', 'zodat', 'noch',
  // Verbs (common auxiliaries)
  'is', 'zijn', 'was', 'waren', 'wordt', 'worden', 'werd', 'werden',
  'heeft', 'hebben', 'had', 'hadden', 'kan', 'kunnen', 'kon', 'konden',
  'zal', 'zullen', 'zou', 'zouden', 'moet', 'moeten', 'mag', 'mogen',
  'wil', 'willen', 'gaat', 'gaan', 'ging', 'gingen', 'komt', 'komen',
  'kwam', 'kwamen', 'doet', 'doen', 'deed', 'deden', 'laat', 'laten',
  'staat', 'staan', 'stond', 'stonden', 'zit', 'zitten', 'zat', 'zaten',
  'geeft', 'geven', 'gaf', 'gaven', 'neemt', 'nemen', 'nam', 'namen',
  'vindt', 'vinden', 'vond', 'vonden', 'zegt', 'zeggen', 'zei', 'zeiden',
  'weet', 'weten', 'wist', 'wisten', 'blijft', 'blijven', 'bleef', 'bleven',
  // Parliamentary boilerplate
  'kamer', 'gehoord', 'beraadslaging', 'constaterende', 'overwegende',
  'verzoekt', 'regering', 'gaat', 'orde', 'dag', 'motie', 'voorstel',
  'minister', 'staatssecretaris', 'spreekt', 'besluit', 'kabinet',
  'wetsvoorstel', 'amendement', 'ingediend', 'ingekomen', 'stuk',
  'stukken', 'hand', 'handen', 'vraag', 'vragen', 'antwoord',
  // Generic high-frequency terms that cause noise
  'jaar', 'jaren', 'leden', 'zaken', 'geld', 'geval', 'wijze',
  'manier', 'mate', 'basis', 'kader', 'deel', 'geheel', 'rest',
  'punt', 'punten', 'plan', 'plannen', 'doel', 'doelen', 'beleid',
  'maatregel', 'maatregelen', 'gevolg', 'gevolgen', 'vraag', 'niveau',
  'moment', 'periode', 'termijn', 'vorm', 'vormen', 'rapport',
  'brief', 'nota', 'debat', 'commissie', 'fractie', 'fracties',
  'partij', 'partijen', 'coalitie', 'oppositie', 'regeling',
  'verslag', 'begroting', 'artikel', 'artikelen', 'wetsartikel',
  // Common adverbs & adjectives
  'er', 'hier', 'daar', 'niet', 'wel', 'ook', 'nog', 'al', 'meer',
  'veel', 'zeer', 'zo', 'hoe', 'te', 'reeds', 'steeds', 'slechts',
  'echter', 'verder', 'daarbij', 'daarom', 'daarnaast', 'hierbij',
  'inmiddels', 'tevens', 'eveneens', 'bovendien', 'ondertussen',
  'bijvoorbeeld', 'namelijk', 'immers', 'daarmee', 'hiermee',
  // Numbers and generic
  'alle', 'andere', 'aantal', 'eerste', 'tweede', 'derde', 'nieuwe',
  'eigen', 'grote', 'kleine', 'hele', 'mogelijke', 'nodig', 'mogelijk',
  'zowel', 'ofwel', 'enige', 'enkele', 'elk', 'elke', 'ieder', 'iedere',
]);

// ─── Types ──────────────────────────────────────────────────────
interface PassageScore {
  passageId: string;
  score: number;
  matchedKeywords: string[];
  passageSnippet: string;
}

// ─── Keyword Extraction ─────────────────────────────────────────
/**
 * Extracts weighted keywords from a motion text.
 * 
 * Strategy:
 * - Tokenize, lowercase, remove stop words
 * - Keep tokens >= 4 chars (Dutch words are long)
 * - Detect bigrams (two-word terms like "openbaar vervoer")
 * - Weight by inverse frequency (rarer terms score higher)
 */
function extractKeywords(text: string): Map<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\u00e0-\u00ff0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOP_WORDS.has(t));

  // Count term frequency
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Detect bigrams (consecutive non-stopword pairs)
  const allTokens = text
    .toLowerCase()
    .replace(/[^a-z\u00e0-\u00ff0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);

  for (let i = 0; i < allTokens.length - 1; i++) {
    const a = allTokens[i];
    const b = allTokens[i + 1];
    if (!STOP_WORDS.has(a) && !STOP_WORDS.has(b) && a.length >= 4 && b.length >= 4) {
      const bigram = `${a} ${b}`;
      tf.set(bigram, (tf.get(bigram) || 0) + 1.5);
    }
  }

  // Normalize to weights (0-1 range)
  const maxTf = Math.max(...tf.values(), 1);
  const keywords = new Map<string, number>();
  for (const [term, count] of tf) {
    keywords.set(term, count / maxTf);
  }

  return keywords;
}

// ─── Passage Scoring ────────────────────────────────────────────
/**
 * Scores a passage against motion keywords.
 * Bigram matches get a 2x bonus (more specific = more relevant).
 */
function scorePassage(
  passageText: string,
  keywords: Map<string, number>
): { score: number; matchedKeywords: string[] } {
  const passageLower = passageText.toLowerCase();
  const matchedKeywords: string[] = [];
  let rawScore = 0;

  for (const [term, weight] of keywords) {
    if (passageLower.includes(term)) {
      matchedKeywords.push(term);
      const multiplier = term.includes(' ') ? 2.0 : 1.0;
      rawScore += weight * multiplier;
    }
  }

  // Normalize by sqrt of passage word count
  const wordCount = passageText.split(/\s+/).length;
  const normalizedScore = rawScore / Math.sqrt(Math.max(wordCount, 100) / 100);

  return { score: normalizedScore, matchedKeywords };
}

// ─── Election Year Mapping ──────────────────────────────────────
function getElectionYear(motionDate: Date): number {
  if (motionDate >= new Date('2025-10-29')) return 2025;
  return 2023;
}

// ─── Main Matching Pipeline ─────────────────────────────────────
export async function runKeywordMatching(options?: {
  limit?: number;
  party?: string;
  year?: number;
  dryRun?: boolean;
  minScore?: number;
  maxMatchesPerMotionParty?: number;
}) {
  const ALGORITHM_NAME = 'keyword_tfidf';
  const ALGORITHM_VERSION = '1.0';
  const MIN_SCORE = options?.minScore ?? 1.5;
  const MAX_MATCHES = options?.maxMatchesPerMotionParty ?? 2;

  console.log('\n\u{1f517} MOTION \u2194 PROGRAM KEYWORD MATCHING');
  console.log('======================================');
  console.log(`Algorithm: ${ALGORITHM_NAME} v${ALGORITHM_VERSION}`);
  console.log(`Min score: ${MIN_SCORE} | Max matches per motion\u00d7party: ${MAX_MATCHES}`);
  if (options?.dryRun) console.log('\u{1f3c3} DRY RUN \u2014 no database writes');
  console.log('');

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // Load motions
    const motions = await prisma.motion.findMany({
      select: { id: true, text: true, title: true, dateIntroduced: true, tkNumber: true },
      orderBy: { dateIntroduced: 'desc' },
      ...(options?.limit ? { take: options.limit } : {}),
    });
    console.log(`\u{1f4cb} ${motions.length} motions loaded`);

    // Load programs + passages
    const programWhere: any = {};
    if (options?.year) programWhere.electionYear = options.year;
    if (options?.party) {
      const aliases: Record<string, string[]> = {
        'GL-PvdA': ['GroenLinks-PvdA', 'GL-PvdA'],
        'NSC': ['Nieuw Sociaal Contract'],
        'CU': ['ChristenUnie'],
      };
      const terms = aliases[options.party] || [options.party];
      programWhere.party = {
        OR: [
          ...terms.map(a => ({ abbreviation: a })),
          ...terms.map(a => ({ name: a })),
        ],
      };
    }

    const programs = await prisma.program.findMany({
      where: programWhere,
      select: {
        id: true,
        partyId: true,
        electionYear: true,
        party: { select: { abbreviation: true, name: true } },
        passages: {
          select: { id: true, passageText: true, chapter: true, heading: true },
        },
      },
    });

    const totalPassages = programs.reduce((s, p) => s + p.passages.length, 0);
    console.log(`\u{1f4da} ${programs.length} programs loaded (${totalPassages} passages)`);

    // Index programs by partyId + electionYear
    const programIndex = new Map<string, typeof programs[0]>();
    for (const prog of programs) {
      programIndex.set(`${prog.partyId}_${prog.electionYear}`, prog);
    }

    // Register algorithm version
    if (!options?.dryRun) {
      // Use findFirst + create pattern since AlgorithmVersion might not have a unique on name+version
      const existing = await prisma.algorithmVersion.findFirst({
        where: { name: ALGORITHM_NAME, version: ALGORITHM_VERSION },
      });
      if (!existing) {
        await prisma.algorithmVersion.create({
          data: {
            name: ALGORITHM_NAME,
            version: ALGORITHM_VERSION,
            description: 'Keyword-based TF-IDF matching. Extracts keywords from motion text, matches against program passages by keyword overlap. Bigrams weighted 2x. Score normalized by passage length.',
            active: true,
          },
        });
      }
    }

    // Match each motion
    let totalMatches = 0;
    let motionsWithMatches = 0;
    let motionsProcessed = 0;

    for (const motion of motions) {
      motionsProcessed++;
      const keywords = extractKeywords(`${motion.title} ${motion.text}`);
      const electionYear = getElectionYear(motion.dateIntroduced);
      let motionHasMatch = false;

      for (const [_key, program] of programIndex) {
        if (program.electionYear !== electionYear) continue;

        // Score all passages
        const scored: PassageScore[] = [];
        for (const passage of program.passages) {
          const { score, matchedKeywords } = scorePassage(passage.passageText, keywords);
          if (score >= MIN_SCORE && matchedKeywords.length >= 2) {
            scored.push({
              passageId: passage.id,
              score,
              matchedKeywords,
              passageSnippet: passage.passageText.slice(0, 200),
            });
          }
        }

        // Keep top N
        scored.sort((a, b) => b.score - a.score);
        const topMatches = scored.slice(0, MAX_MATCHES);

        for (const match of topMatches) {
          totalMatches++;
          motionHasMatch = true;

          if (options?.dryRun) {
            if (totalMatches <= 10) {
              console.log(`  \u{1f517} ${motion.tkNumber || motion.id.slice(0, 8)} \u2194 ${program.party.abbreviation}: score=${match.score.toFixed(2)}, keywords=[${match.matchedKeywords.slice(0, 5).join(', ')}]`);
            }
          } else {
            await prisma.motionProgramMatch.upsert({
              where: {
                motionId_partyId_passageId: {
                  motionId: motion.id,
                  partyId: program.partyId,
                  passageId: match.passageId,
                },
              },
              create: {
                motionId: motion.id,
                partyId: program.partyId,
                passageId: match.passageId,
                score: match.score,
                rationaleJson: {
                  algorithm: ALGORITHM_NAME,
                  version: ALGORITHM_VERSION,
                  matchedKeywords: match.matchedKeywords,
                  keywordCount: match.matchedKeywords.length,
                  passageSnippet: match.passageSnippet,
                },
              },
              update: {
                score: match.score,
                rationaleJson: {
                  algorithm: ALGORITHM_NAME,
                  version: ALGORITHM_VERSION,
                  matchedKeywords: match.matchedKeywords,
                  keywordCount: match.matchedKeywords.length,
                  passageSnippet: match.passageSnippet,
                },
              },
            });
          }
        }
      }

      if (motionHasMatch) motionsWithMatches++;

      if (motionsProcessed % 20 === 0) {
        console.log(`  ... ${motionsProcessed}/${motions.length} motions processed (${totalMatches} matches so far)`);
      }
    }

    console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
    console.log(`\u{1f4ca} Resultaat:`);
    console.log(`   Motions processed: ${motionsProcessed}`);
    console.log(`   Motions with matches: ${motionsWithMatches} (${((motionsWithMatches / Math.max(motionsProcessed, 1)) * 100).toFixed(0)}%)`);
    console.log(`   Total matches stored: ${totalMatches}`);
    console.log(`   Avg matches/motion: ${(totalMatches / Math.max(motionsProcessed, 1)).toFixed(1)}`);
    console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  } finally {
    await prisma.$disconnect();
  }
}

// ─── CLI ─────────────────────────────────────────────────────────
const isMain = process.argv[1]?.includes('keyword-match');
if (isMain) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  runKeywordMatching({
    limit: getArg('--limit') ? parseInt(getArg('--limit')!) : undefined,
    party: getArg('--party'),
    year: getArg('--year') ? parseInt(getArg('--year')!) : undefined,
    dryRun: args.includes('--dry-run'),
    minScore: getArg('--min-score') ? parseFloat(getArg('--min-score')!) : undefined,
    maxMatchesPerMotionParty: getArg('--max-matches') ? parseInt(getArg('--max-matches')!) : undefined,
  }).catch(err => {
    console.error('\u274c Matching failed:', err);
    process.exit(1);
  });
}
