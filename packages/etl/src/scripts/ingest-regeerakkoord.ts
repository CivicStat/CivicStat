/**
 * Regeerakkoord Ingestion Pipeline
 *
 * Downloads, parses, extracts commitments via AI model, and seeds
 * regeerakkoord (coalition agreement) promises into the database.
 *
 * Supports multiple AI providers via OpenRouter (Claude, GPT-4o, Gemini, etc.)
 * or direct Anthropic API as fallback.
 *
 * Usage:
 *   npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord schoof
 *   npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord jetten
 *   npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord schoof --step extract
 *   npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord jetten --dry-run
 *
 * Environment:
 *   OPENROUTER_API_KEY — Preferred: OpenRouter key (access to all models)
 *   ANTHROPIC_API_KEY  — Fallback: direct Anthropic API
 *   AI_MODEL_EXTRACT   — Override model for extraction
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAIClient, chatWithRetry, getModel, modelShortName } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = join(__dirname, '..', '..', 'data', 'programs');
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises');
const MANIFEST_PATH = join(DATA_DIR, 'regeerakkoorden.json');

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────

interface AkkoordConfig {
  name: string;
  title: string;
  subtitle: string;
  date: string;
  electionYear: number;
  leadParty: string;
  coalitionParties: string[];
  pdfFilename: string;
  pdfUrl: string;
  sourceUrl: string;
  promiseCodePrefix: string;
  notes: string;
}

interface ExtractedPromise {
  promiseCode: string;
  text: string;
  summary: string;
  theme: string;
  specificity: 'SPECIFIEK' | 'GEMIDDELD' | 'VAAG';
  keywords: string[];
  sourcePages: string;
  originalQuote: string;
}

// ─── Valid constants (shared with extract-promises-from-program.ts) ──

const VALID_THEMES = [
  'DEFENSIE', 'WONEN', 'MIGRATIE', 'KLIMAAT', 'ZORG',
  'ONDERWIJS', 'ECONOMIE', 'VEILIGHEID', 'BESTUUR', 'SOCIAAL',
  'LANDBOUW', 'BUITENLAND',
] as const;

const VALID_SPECIFICITIES = ['SPECIFIEK', 'GEMIDDELD', 'VAAG'] as const;

const SPECIFICITY_MAP: Record<string, string> = {
  'SPECIFIEK': 'CONCRETE',
  'GEMIDDELD': 'DIRECTIONAL',
  'VAAG': 'VAGUE',
  'CONCRETE': 'CONCRETE',
  'DIRECTIONAL': 'DIRECTIONAL',
  'VAGUE': 'VAGUE',
};

// ─── Helpers ────────────────────────────────────────────────────

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// ─── PDF Parsing (reuses pattern from programmas.ts) ────────────

async function parsePdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  let pdfParse: any;
  try {
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = typeof mod.default === 'function' ? mod.default : mod;
  } catch {
    throw new Error('pdf-parse is not installed. Run: cd packages/etl && npm install pdf-parse');
  }

  const data = await pdfParse(buffer);
  return { text: data.text, pageCount: data.numpages };
}

// ─── Chapter Detection & Chunking ───────────────────────────────

interface TextChunk {
  title: string;
  text: string;
  startPage: number;
}

function detectChapters(fullText: string): Array<{ title: string; startPage: number; endPage: number; text: string }> {
  const chapterPatterns = [
    /^Hoofdstuk\s+\d+/i,
    /^\d+\.\s+[A-Z][a-zA-Z\s]+$/,
    /^[A-Z][A-Z\s]{8,}$/,
    /^Deel\s+\d+/i,
  ];

  const lines = fullText.split('\n');
  const chapters: Array<{ title: string; startPage: number; endPage: number; text: string }> = [];
  let currentTitle = 'Inleiding';
  let currentText = '';
  let chapterStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isChapter = chapterPatterns.some(p => p.test(line)) && line.length < 120;

    if (isChapter && currentText.length > 100) {
      chapters.push({
        title: currentTitle,
        startPage: chapterStart,
        endPage: chapterStart,
        text: currentText,
      });
      currentTitle = line;
      currentText = '';
      chapterStart = i;
    }

    currentText += lines[i] + '\n';
  }

  // Flush remaining
  if (currentText.trim().length > 50) {
    chapters.push({
      title: currentTitle,
      startPage: chapterStart,
      endPage: chapterStart,
      text: currentText,
    });
  }

  // If no chapters detected, treat entire text as one chapter
  if (chapters.length === 0) {
    chapters.push({
      title: 'Volledig akkoord',
      startPage: 0,
      endPage: 0,
      text: fullText,
    });
  }

  return chapters;
}

function splitIntoChunks(chapters: Array<{ title: string; startPage: number; endPage: number; text: string }>): TextChunk[] {
  const MAX_WORDS = 4000;
  const chunks: TextChunk[] = [];

  for (const chapter of chapters) {
    const words = chapter.text.split(/\s+/).length;

    if (words <= MAX_WORDS) {
      chunks.push({ title: chapter.title, text: chapter.text, startPage: chapter.startPage });
      continue;
    }

    const paragraphs = chapter.text.split(/\n\n+/);
    let currentText = '';
    let currentWords = 0;
    let partNum = 1;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).length;

      if (currentWords + paraWords > MAX_WORDS && currentText.length > 0) {
        chunks.push({
          title: `${chapter.title} (deel ${partNum})`,
          text: currentText.trim(),
          startPage: chapter.startPage,
        });
        partNum++;
        currentText = '';
        currentWords = 0;
      }

      currentText += para + '\n\n';
      currentWords += paraWords;
    }

    if (currentText.trim().length > 100) {
      chunks.push({
        title: `${chapter.title} (deel ${partNum})`,
        text: currentText.trim(),
        startPage: chapter.startPage,
      });
    }
  }

  return chunks;
}

// ─── AI API (via unified client) ────────────────────────────────
// Now routes through OpenRouter or direct Anthropic automatically

// ─── Extraction Prompt (tailored for regeerakkoord) ─────────────

function buildRegeerakkoordPrompt(
  akkoordName: string,
  coalitionParties: string[],
  chunkText: string,
  year: number,
): string {
  return `Je bent een neutrale data-extractie-assistent voor CivicStat, een transparantieplatform voor de Nederlandse politiek. Extraheer concrete beleidsafspraken uit het onderstaande gedeelte van het regeerakkoord "${akkoordName}" (coalitie: ${coalitionParties.join(', ')}, ${year}).

REGELS:
- Extraheer ALLEEN concrete coalitieverplichtingen, beleidsmaatregelen, of meetbare doelstellingen
  die de coalitie zich voorneemt te realiseren
- GEEN waardeverklaringen, diagnoses, intenties, of vage ambities
- Elke afspraak moet toetsbaar zijn aan parlementair stemgedrag (moties, amendementen, wetten)
- Bij een regeerakkoord geldt: alle coalitiepartijen worden geacht VOOR te stemmen
- Geef per afspraak 3-8 inhoudelijke kernwoorden (zelfstandige naamwoorden, beleidstermen)
- Classificeer specificiteit:
  - SPECIFIEK: meetbaar getal, deadline, of concreet beleidsinstrument
  - GEMIDDELD: duidelijke richting zonder exact getal
  - VAAG: brede ambitie, moeilijk falsifieerbaar
- Kies het best passende thema uit: ZORG, KLIMAAT, MIGRATIE, ECONOMIE, LANDBOUW, WONEN,
  BESTUUR, SOCIAAL, ONDERWIJS, BUITENLAND, VEILIGHEID, DEFENSIE

FORMAAT — antwoord ALLEEN met een valid JSON array, geen uitleg:
[
  {
    "text": "Genormaliseerde samenvatting van de beleidsafspraak (max 100 woorden, Nederlands)",
    "summary": "Korte samenvatting (max 100 tekens)",
    "theme": "THEMA",
    "specificity": "SPECIFIEK|GEMIDDELD|VAAG",
    "keywords": ["kernwoord1", "kernwoord2", "kernwoord3"],
    "sourcePages": "p. 12-13",
    "originalQuote": "Exacte zin(nen) uit het akkoord"
  }
]

TEKST:
---
${chunkText}
---`;
}

// ─── Validation ─────────────────────────────────────────────────

function validatePromise(p: any): ExtractedPromise | null {
  if (!p.text || !p.summary || !p.theme) return null;

  const theme = p.theme.toUpperCase();
  if (!VALID_THEMES.includes(theme as any)) {
    console.warn(`    ⚠ Invalid theme "${p.theme}", skipping`);
    return null;
  }

  const specificity = (p.specificity || 'GEMIDDELD').toUpperCase();
  if (!VALID_SPECIFICITIES.includes(specificity as any)) {
    console.warn(`    ⚠ Invalid specificity "${p.specificity}", defaulting to GEMIDDELD`);
  }

  return {
    promiseCode: '',
    text: p.text.trim(),
    summary: p.summary.trim(),
    theme: theme as string,
    specificity: (VALID_SPECIFICITIES.includes(specificity as any) ? specificity : 'GEMIDDELD') as ExtractedPromise['specificity'],
    keywords: Array.isArray(p.keywords) ? p.keywords.map((k: any) => String(k).toLowerCase()) : [],
    sourcePages: p.sourcePages || '',
    originalQuote: p.originalQuote || p.text || '',
  };
}

// ─── Deduplication ──────────────────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const unionSize = wordsA.size + wordsB.size - intersection;
  return unionSize > 0 ? intersection / unionSize : 0;
}

function deduplicatePromises(promises: ExtractedPromise[]): ExtractedPromise[] {
  const unique: ExtractedPromise[] = [];
  for (const p of promises) {
    const isDupe = unique.some(existing => jaccardSimilarity(existing.summary, p.summary) > 0.7);
    if (!isDupe) {
      unique.push(p);
    } else {
      console.log(`    🔄 Dedup: skipping "${p.summary.slice(0, 60)}..."`);
    }
  }
  return unique;
}

// ─── Find Party by Abbreviation ─────────────────────────────────

const PARTY_ALIASES: Record<string, string[]> = {
  'GL-PvdA': ['GroenLinks-PvdA', 'GL-PvdA', 'GroenLinks'],
  'NSC': ['Nieuw Sociaal Contract'],
  'CU': ['ChristenUnie'],
  'PvdD': ['Partij voor de Dieren'],
  'FVD': ['Forum voor Democratie'],
  'SGP': ['Staatkundig Gereformeerde Partij'],
  'DENK': ['DENK'],
  'Volt': ['Volt', 'Volt Nederland'],
  'JA21': ['JA21'],
};

async function findPartyByAbbr(abbreviation: string) {
  const aliases = PARTY_ALIASES[abbreviation] || [];
  const searchTerms = [abbreviation, ...aliases];

  return prisma.party.findFirst({
    where: {
      OR: [
        ...searchTerms.map(term => ({ abbreviation: { equals: term, mode: 'insensitive' as const } })),
        ...searchTerms.map(term => ({ name: term })),
      ],
    },
  });
}

// ─── Main Pipeline ──────────────────────────────────────────────

export interface RegeerakkoordOptions {
  akkoord: 'schoof' | 'jetten';
  step?: 'parse' | 'extract' | 'seed' | 'all';
  dryRun?: boolean;
  replace?: boolean;
}

export async function ingestRegeerakkoord(options: RegeerakkoordOptions): Promise<void> {
  const { akkoord, step = 'all', dryRun = false } = options;

  console.log(`\n📜 REGEERAKKOORD INGESTION`);
  console.log('================================');
  console.log(`Akkoord: ${akkoord}`);
  console.log(`Step: ${step}`);
  console.log(`Dry run: ${dryRun}\n`);

  // Load manifest
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Regeerakkoorden manifest not found: ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const config: AkkoordConfig = manifest.akkoorden[akkoord];
  if (!config) {
    throw new Error(`Unknown akkoord: "${akkoord}". Available: ${Object.keys(manifest.akkoorden).join(', ')}`);
  }

  console.log(`📄 ${config.title}`);
  console.log(`   ${config.subtitle}`);
  console.log(`   Datum: ${config.date}`);
  console.log(`   Coalitie: ${config.coalitionParties.join(', ')}\n`);

  const pdfPath = join(DATA_DIR, config.pdfFilename);
  const parsedPath = join(DATA_DIR, `regeerakkoord-${akkoord}_${config.electionYear}-parsed.json`);
  const promisesPath = join(PROMISES_DIR, `regeerakkoord-${akkoord}-${config.electionYear}.json`);

  try {
    // ─── Step 1: Parse PDF ────────────────────────────────────
    if (step === 'all' || step === 'parse') {
      console.log('📖 Step 1: Parsing PDF...');

      if (!existsSync(pdfPath)) {
        throw new Error(`PDF not found: ${pdfPath}. Download it first.`);
      }

      const buffer = readFileSync(pdfPath);
      const hash = sha256(buffer);
      const sizeBytes = statSync(pdfPath).size;
      const { text, pageCount } = await parsePdf(buffer);
      const totalWords = text.split(/\s+/).filter(Boolean).length;
      const chapters = detectChapters(text);

      const parsed = {
        akkoord,
        name: config.name,
        title: config.title,
        pdfHash: hash,
        pdfSizeBytes: sizeBytes,
        pageCount,
        totalWords,
        fullText: text,
        chapters,
        parsedAt: new Date().toISOString(),
      };

      writeFileSync(parsedPath, JSON.stringify(parsed, null, 2));
      console.log(`   ✅ Parsed: ${pageCount} pages, ${totalWords} words, ${chapters.length} chapters`);
      console.log(`   → ${parsedPath}\n`);
    }

    // ─── Step 2: Extract promises via Claude ──────────────────
    if (step === 'all' || step === 'extract') {
      const model = getModel('extract');
      let ai: AIClient | null = null;
      if (!dryRun) {
        ai = createAIClient();
        console.log(`🤖 Step 2: Extracting commitments via ${ai.provider} (${modelShortName(model)})...`);
      } else {
        console.log('🤖 Step 2: Extracting commitments (dry run)...');
      }

      if (!existsSync(parsedPath)) {
        throw new Error(`Parsed JSON not found: ${parsedPath}. Run with --step parse first.`);
      }

      if (existsSync(promisesPath) && !options.replace) {
        const existing = JSON.parse(readFileSync(promisesPath, 'utf-8'));
        console.log(`   ⏭ Already extracted (${existing.totalPromises} promises). Use --replace to re-extract.`);
      } else {
        const parsed = JSON.parse(readFileSync(parsedPath, 'utf-8'));
        const chunks = splitIntoChunks(parsed.chapters);

        if (dryRun) {
          console.log(`   [DRY RUN] Would extract from ${chunks.length} chunks:`);
          for (const ch of chunks) {
            const words = ch.text.split(/\s+/).length;
            console.log(`     - "${ch.title}" (${words} words)`);
          }
        } else {
          let allPromises: ExtractedPromise[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const words = chunk.text.split(/\s+/).length;

            if (words < 100) {
              console.log(`   ⏭ Chunk "${chunk.title}" too short (${words} words), skipping`);
              continue;
            }

            console.log(`   📄 Chunk ${i + 1}/${chunks.length}: "${chunk.title}" (${words} words)`);

            try {
              const prompt = buildRegeerakkoordPrompt(
                config.title,
                config.coalitionParties,
                chunk.text,
                config.electionYear,
              );
              const aiResponse = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
                traceName: 'extract-regeerakkoord',
                traceTags: ['etl', 'regeerakkoord'],
              });
              const response = aiResponse.text;

              let jsonStr = response.trim();
              if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
              }

              const rawPromises = JSON.parse(jsonStr);
              if (!Array.isArray(rawPromises)) {
                console.warn(`   ⚠ Expected array, got ${typeof rawPromises}`);
                continue;
              }

              let validCount = 0;
              for (const raw of rawPromises) {
                const validated = validatePromise(raw);
                if (validated) {
                  allPromises.push(validated);
                  validCount++;
                }
              }
              console.log(`   ✅ ${validCount} commitments extracted`);

              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
              console.error(`   ❌ Failed on chunk "${chunk.title}": ${err}`);
            }
          }

          // Deduplicate
          allPromises = deduplicatePromises(allPromises);

          // Assign promise codes
          for (let i = 0; i < allPromises.length; i++) {
            allPromises[i].promiseCode = `${config.promiseCodePrefix}-${String(i + 1).padStart(3, '0')}`;
          }

          // Write output JSON
          const output = {
            akkoord,
            party: config.leadParty,
            partySlug: config.leadParty.toLowerCase(),
            program: config.title,
            coalitionParties: config.coalitionParties,
            electionYear: config.electionYear,
            extractionDate: new Date().toISOString().split('T')[0],
            extractionMethod: `llm-${modelShortName(getModel('extract'))}-v1-regeerakkoord`,
            sourceUrl: config.sourceUrl,
            pdfHash: parsed.pdfHash || '',
            totalPromises: allPromises.length,
            promises: allPromises.map(p => ({
              promiseCode: p.promiseCode,
              text: p.text,
              summary: p.summary,
              theme: p.theme,
              specificity: p.specificity,
              keywords: p.keywords,
              sourceRef: `${config.title}, ${p.sourcePages}`,
              originalQuote: p.originalQuote,
            })),
          };

          writeFileSync(promisesPath, JSON.stringify(output, null, 2));
          console.log(`   ✅ ${allPromises.length} commitments → ${promisesPath}\n`);
        }
      }
    }

    // ─── Step 3: Seed to database ─────────────────────────────
    if (step === 'all' || step === 'seed') {
      console.log('🌱 Step 3: Seeding to database...');

      if (dryRun) {
        console.log('   [DRY RUN] Would seed promises to database. Skipping.');
      } else {
        if (!existsSync(promisesPath)) {
          throw new Error(`Promises JSON not found: ${promisesPath}. Run with --step extract first.`);
        }

        const promiseData = JSON.parse(readFileSync(promisesPath, 'utf-8'));

        // Resolve party IDs
        const leadParty = await findPartyByAbbr(config.leadParty);
        if (!leadParty) {
          throw new Error(`Lead party not found: ${config.leadParty}`);
        }

        const coalitionPartyRecords = await Promise.all(
          config.coalitionParties.map(async (abbr: string) => {
            const party = await findPartyByAbbr(abbr);
            if (!party) console.warn(`   ⚠ Coalition party not found: ${abbr}`);
            return party;
          })
        );
        const coalitionPartyIds = coalitionPartyRecords
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map(p => p.id);

        console.log(`   Lead party: ${leadParty.abbreviation} (${leadParty.id})`);
        console.log(`   Coalition IDs: ${coalitionPartyIds.length} parties resolved`);

        // Load parsed data for rawText
        let rawText = '';
        let pdfHash = '';
        let pdfSizeBytes = 0;
        let pageCount = 0;
        if (existsSync(parsedPath)) {
          const parsed = JSON.parse(readFileSync(parsedPath, 'utf-8'));
          rawText = parsed.fullText || '';
          pdfHash = parsed.pdfHash || '';
          pdfSizeBytes = parsed.pdfSizeBytes || 0;
          pageCount = parsed.pageCount || 0;
        }

        // Find or create Program record (manual upsert to avoid Prisma compound key version issues)
        let program = await prisma.program.findFirst({
          where: {
            partyId: leadParty.id,
            electionYear: config.electionYear,
            programType: 'REGEERAKKOORD',
          },
        });

        if (program) {
          program = await prisma.program.update({
            where: { id: program.id },
            data: {
              coalitionPartyIds: coalitionPartyIds,
              title: config.title,
              sourceUrl: config.sourceUrl,
              rawText: rawText,
              pdfHash,
              pdfSizeBytes,
              pageCount,
            },
          });
        } else {
          program = await prisma.program.create({
            data: {
              partyId: leadParty.id,
              electionYear: config.electionYear,
              programType: 'REGEERAKKOORD' as any,
              coalitionPartyIds: coalitionPartyIds,
              title: config.title,
              sourceUrl: config.sourceUrl,
              rawText: rawText,
              pdfHash,
              pdfSizeBytes,
              downloadedAt: new Date(),
              pageCount,
            },
          });
        }

        console.log(`   ✅ Program record: ${program.id}`);

        // Optionally delete existing promises
        if (options.replace) {
          const deleted = await prisma.promise.deleteMany({
            where: { programId: program.id },
          });
          console.log(`   🗑 Deleted ${deleted.count} existing promises`);
        }

        // Upsert promises
        let seeded = 0;
        for (const promise of promiseData.promises) {
          try {
            const mappedSpecificity = SPECIFICITY_MAP[promise.specificity?.toUpperCase()] || 'DIRECTIONAL';

            await prisma.promise.upsert({
              where: {
                programId_promiseCode: {
                  programId: program.id,
                  promiseCode: promise.promiseCode,
                },
              },
              update: {
                text: promise.text,
                summary: promise.summary,
                theme: promise.theme as any,
                specificity: mappedSpecificity as any,
                keywords: promise.keywords || [],
                sourceRef: promise.sourceRef || null,
                extractedBy: `llm-${modelShortName(getModel('extract'))}-v1-regeerakkoord`,
              },
              create: {
                programId: program.id,
                promiseCode: promise.promiseCode,
                text: promise.text,
                summary: promise.summary,
                theme: promise.theme as any,
                specificity: mappedSpecificity as any,
                keywords: promise.keywords || [],
                sourceRef: promise.sourceRef || null,
                passageId: null,
                expectedVoteDirection: 'VOOR',
                extractedBy: `llm-${modelShortName(getModel('extract'))}-v1-regeerakkoord`,
              },
            });
            seeded++;
          } catch (err) {
            console.error(`   ❌ Failed to seed ${promise.promiseCode}: ${err}`);
          }
        }

        console.log(`   ✅ ${seeded} promises seeded for ${config.title}\n`);
      }
    }

    console.log('🎉 Regeerakkoord ingestion complete!');
  } finally {
    await prisma.$disconnect();
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────
const isCli = process.argv[1]?.includes('ingest-regeerakkoord');
if (isCli) {
  const args = process.argv.slice(2);
  const akkoordArg = args.find(a => a === '--akkoord')
    ? args[args.indexOf('--akkoord') + 1]
    : args[0];

  if (!akkoordArg || !['schoof', 'jetten'].includes(akkoordArg)) {
    console.log('Usage: npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord schoof|jetten');
    console.log('       npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord schoof --step parse|extract|seed|all');
    console.log('       npx tsx src/scripts/ingest-regeerakkoord.ts --akkoord jetten --dry-run');
    process.exit(1);
  }

  const stepArg = args.find(a => a === '--step')
    ? args[args.indexOf('--step') + 1] as any
    : 'all';
  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');

  ingestRegeerakkoord({
    akkoord: akkoordArg as 'schoof' | 'jetten',
    step: stepArg,
    dryRun,
    replace,
  }).catch(err => {
    console.error('❌ Regeerakkoord ingest failed:', err);
    process.exit(1);
  });
}
