/**
 * LLM-Assisted Promise Extraction from Parsed Programs.
 *
 * Reads parsed JSON from data/programs/ and uses an AI model to extract
 * 50-100 concrete, testable promises per party program.
 *
 * Supports multiple AI providers via OpenRouter (Claude, GPT-4o, Gemini, etc.)
 * or direct Anthropic API as fallback.
 *
 * Output: JSON files in data/promises/{slug}-tk{year}.json
 *
 * Usage:
 *   npx tsx src/scripts/extract-promises-from-program.ts                    # All parties
 *   npx tsx src/scripts/extract-promises-from-program.ts --party VVD        # Only VVD
 *   npx tsx src/scripts/extract-promises-from-program.ts --dry-run          # Preview only
 *
 * Environment:
 *   OPENROUTER_API_KEY — Preferred: OpenRouter key (access to all models)
 *   ANTHROPIC_API_KEY  — Fallback: direct Anthropic API
 *   AI_MODEL_EXTRACT   — Override model for extraction
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAIClient, chatWithRetry, getModel, modelShortName } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROGRAMS_DIR = join(__dirname, '..', '..', 'data', 'programs');
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises');
const MANIFEST_PATH = join(PROGRAMS_DIR, 'manifest.json');

// ─── Types ──────────────────────────────────────────────────────

interface ParsedProgram {
  party: string;
  partySlug: string;
  filename: string;
  pdfHash: string;
  pdfSizeBytes: number;
  fullText: string;
  chapters: Array<{ title: string; startPage: number; endPage: number; text: string }>;
  pageCount: number;
  totalWords: number;
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

export interface PartyPromiseFile {
  party: string;
  partySlug: string;
  program: string;
  electionYear: number;
  extractionDate: string;
  extractionMethod: string;
  sourceUrl: string;
  pdfHash: string;
  totalPromises: number;
  promises: Array<{
    promiseCode: string;
    text: string;
    summary: string;
    theme: string;
    specificity: string;
    keywords: string[];
    sourceRef: string;
    originalQuote: string;
  }>;
}

// ─── Valid Themes ───────────────────────────────────────────────

const VALID_THEMES = [
  'DEFENSIE', 'WONEN', 'MIGRATIE', 'KLIMAAT', 'ZORG',
  'ONDERWIJS', 'ECONOMIE', 'VEILIGHEID', 'BESTUUR', 'SOCIAAL',
  'LANDBOUW', 'BUITENLAND',
] as const;

const VALID_SPECIFICITIES = ['SPECIFIEK', 'GEMIDDELD', 'VAAG'] as const;

// ─── Prompt Template (Dutch) ────────────────────────────────────

function buildExtractionPrompt(party: string, chunkText: string, year: number): string {
  return `Je bent een STRENGE data-extractie-assistent voor CivicStat, een transparantieplatform voor de Nederlandse politiek. Extraheer ALLEEN harde, toetsbare verkiezingsbeloften uit het onderstaande gedeelte van het ${party} verkiezingsprogramma (TK${year}).

KERNREGEL — KWALITEIT BOVEN KWANTITEIT:
Typisch bevat een verkiezingsprogramma 30-100 echte, toetsbare beloften. Wees ZEER selectief.
Als je twijfelt of iets een echte belofte is: LAAT HET WEG.

WAT IS WEL EEN BELOFTE (extraheer):
- Concrete beleidsmaatregelen: "De basisbeurs wordt verhoogd naar €500 per maand"
- Meetbare doelstellingen: "In 2030 moeten alle nieuwbouwwoningen energieneutraal zijn"
- Specifieke wetgevende acties: "Het kraakverbod wordt uitgebreid"
- Budgettaire toezeggingen: "€2 miljard extra voor defensie"

WAT IS GEEN BELOFTE (NIET extraheren):
- Waardeverklaringen: "Wij geloven in vrijheid", "Onderwijs is de basis van onze samenleving"
- Diagnoses/analyses: "De woningmarkt zit vast", "De zorgkosten stijgen te hard"
- Vage aspiraties: "Een sterk Europa", "Betere zorg voor iedereen"
- Procesbeschrijvingen: "Wij gaan in gesprek met...", "Er komt een onderzoek naar..."
- Herhalingen van bestaand beleid: "We handhaven de huidige normen"
- Subdoelen die al vallen onder een breder geëxtraheerd punt
- Open intenties zonder concreet eindresultaat: "Wij zetten ons in voor...", "Wij streven naar..."
- Containerbegrippen: "een eerlijke economie", "duurzame landbouw" (tenzij er een concreet middel bij staat)

DEDUPLICATIE:
- Extraheer NIET meerdere beloften die op hetzelfde beleidspunt slaan
- Als een programma 3 zinnen wijdt aan "meer woningen bouwen", maak daar EEN belofte van
- Kies de meest concrete variant als er overlap is

CLASSIFICEER specificiteit STRENG:
  - SPECIFIEK: meetbaar getal, deadline, of concreet beleidsinstrument (bijv. "100.000 woningen per jaar", "afschaffen van de verhuurderheffing")
  - GEMIDDELD: duidelijke beleidsrichting met een concreet middel, zonder exact getal (bijv. "De AOW-leeftijd wordt verlaagd")
  - VAAG: brede ambitie zonder concreet middel — deze worden later WEGGEFILTERD, dus extraheer ze bij voorkeur NIET

THEMA — kies uit: ZORG, KLIMAAT, MIGRATIE, ECONOMIE, LANDBOUW, WONEN, BESTUUR, SOCIAAL, ONDERWIJS, BUITENLAND, VEILIGHEID, DEFENSIE

KERNWOORDEN: 3-8 inhoudelijke beleidstermen per belofte (zelfstandige naamwoorden)

FORMAAT — antwoord ALLEEN met een valid JSON array, geen uitleg:
[
  {
    "text": "Genormaliseerde samenvatting (max 100 woorden, Nederlands)",
    "summary": "Korte samenvatting (max 100 tekens)",
    "theme": "THEMA",
    "specificity": "SPECIFIEK|GEMIDDELD|VAAG",
    "keywords": ["kernwoord1", "kernwoord2", "kernwoord3"],
    "sourcePages": "p. 12-13",
    "originalQuote": "Exacte zin(nen) uit het programma"
  }
]

TEKST:
---
${chunkText}
---`;
}

// ─── AI API Call (via unified client) ────────────────────────────
// Now routes through OpenRouter or direct Anthropic automatically

// ─── Validation ─────────────────────────────────────────────────

function validatePromise(p: any): ExtractedPromise | null {
  if (!p.text || !p.summary || !p.theme) return null;

  // Validate theme
  const theme = p.theme.toUpperCase();
  if (!VALID_THEMES.includes(theme as any)) {
    console.warn(`    ⚠ Invalid theme "${p.theme}", skipping`);
    return null;
  }

  // Validate specificity
  const specificity = (p.specificity || 'GEMIDDELD').toUpperCase();
  if (!VALID_SPECIFICITIES.includes(specificity as any)) {
    console.warn(`    ⚠ Invalid specificity "${p.specificity}", defaulting to GEMIDDELD`);
  }

  const finalSpecificity = VALID_SPECIFICITIES.includes(specificity as any) ? specificity : 'GEMIDDELD';

  // Post-extraction filter: reject VAAG promises — they are too vague to match to motions
  if (finalSpecificity === 'VAAG') {
    console.log(`    🔻 Filtered VAAG: "${p.summary?.slice(0, 60)}..."`);
    return null;
  }

  // Minimum quality checks
  const text = p.text.trim();
  if (text.length < 20) {
    console.log(`    🔻 Filtered too-short promise (${text.length} chars): "${text}"`);
    return null;
  }

  return {
    promiseCode: '', // will be assigned later
    text,
    summary: p.summary.trim(),
    theme: theme as string,
    specificity: finalSpecificity as ExtractedPromise['specificity'],
    keywords: Array.isArray(p.keywords) ? p.keywords.map((k: any) => String(k).toLowerCase()) : [],
    sourcePages: p.sourcePages || '',
    originalQuote: p.originalQuote || p.text || '',
  };
}

// ─── Chapter Splitting (~4000 words) ────────────────────────────

interface TextChunk {
  title: string;
  text: string;
  startPage: number;
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

    // Split at paragraph boundaries
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

// ─── De-duplication (cross-chunk) ───────────────────────────────

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
    const isDupe = unique.some(existing => jaccardSimilarity(existing.summary, p.summary) > 0.6);
    if (!isDupe) {
      unique.push(p);
    } else {
      console.log(`    🔄 Dedup: skipping "${p.summary.slice(0, 60)}..."`);
    }
  }
  return unique;
}

// ─── Main Extraction Logic ──────────────────────────────────────

interface ExtractOptions {
  party?: string;
  year?: number;
  dryRun?: boolean;
}

export async function extractPromisesFromPrograms(options: ExtractOptions = {}): Promise<void> {
  const year = options.year ?? 2023;

  // Initialize AI client
  const model = getModel('extract');
  let ai: AIClient | null = null;
  if (!options.dryRun) {
    ai = createAIClient();
  }

  console.log(`\n[EXTRACT] Promise extraction (year=${year}, party=${options.party || 'all'}, dryRun=${options.dryRun || false})`);
  if (ai) {
    console.log(`[EXTRACT] Provider: ${ai.provider} | Model: ${modelShortName(model)}`);
  }
  console.log();

  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const yearData = manifest.programs[String(year)];
  if (!yearData) throw new Error(`Year ${year} not found in manifest`);

  const entries = options.party
    ? yearData.parties.filter((p: any) => p.abbreviation === options.party)
    : yearData.parties;

  let totalExtracted = 0;
  let totalSkipped = 0;

  for (const entry of entries) {
    const abbr = entry.abbreviation;
    const slug = abbr.toLowerCase();
    const parsedPath = join(PROGRAMS_DIR, `${slug}_${year}-parsed.json`);

    if (!existsSync(parsedPath)) {
      console.log(`  ⏭ ${abbr}: No parsed JSON found (${parsedPath}) — run 'parse-program' first`);
      totalSkipped++;
      continue;
    }

    // Check if output already exists
    const outputPath = join(PROMISES_DIR, `${slug}-tk${year}.json`);
    if (existsSync(outputPath) && !options.dryRun) {
      const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
      console.log(`  ⏭ ${abbr}: Already extracted (${existing.totalPromises} promises in ${outputPath}). Delete to re-extract.`);
      totalSkipped++;
      continue;
    }

    console.log(`\n  🔍 Extracting promises from ${abbr}...`);
    const parsed: ParsedProgram = JSON.parse(readFileSync(parsedPath, 'utf-8'));

    if (options.dryRun) {
      const chunks = splitIntoChunks(parsed.chapters);
      console.log(`    [DRY RUN] Would extract from ${chunks.length} chunks (split from ${parsed.chapters.length} chapters, ${parsed.totalWords} words)`);
      for (const ch of chunks) {
        const words = ch.text.split(/\s+/).length;
        console.log(`      - "${ch.title}" (${words} words, page ~${ch.startPage})`);
      }
      // Show first prompt
      if (chunks.length > 0) {
        const firstPrompt = buildExtractionPrompt(abbr, chunks[0].text.slice(0, 500) + '...', year);
        console.log(`    [DRY RUN] First prompt preview (truncated):\n${firstPrompt.slice(0, 300)}...`);
      }
      continue;
    }

    // Split chapters into ~4000 word chunks
    const chunks = splitIntoChunks(parsed.chapters);
    let allPromises: ExtractedPromise[] = [];
    let chunkIdx = 0;

    for (const chunk of chunks) {
      chunkIdx++;
      const words = chunk.text.split(/\s+/).length;

      // Skip very short chunks (likely TOC, colophon, etc.)
      if (words < 100) {
        console.log(`    ⏭ Chunk "${chunk.title}" too short (${words} words), skipping`);
        continue;
      }

      console.log(`    📄 Chunk ${chunkIdx}/${chunks.length}: "${chunk.title}" (${words} words)`);

      try {
        const prompt = buildExtractionPrompt(abbr, chunk.text, year);
        const aiResponse = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
          traceName: 'extract-promises',
          traceTags: ['etl', 'extract-promises', abbr],
        });
        const response = aiResponse.text;

        // Parse JSON from response — handle potential markdown wrapping
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        const rawPromises = JSON.parse(jsonStr);

        if (!Array.isArray(rawPromises)) {
          console.warn(`    ⚠ Expected array, got ${typeof rawPromises}`);
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

        console.log(`    ✅ ${validCount} promises extracted from chunk`);

        // Rate limiting: wait 1s between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`    ❌ Failed to extract from chunk "${chunk.title}": ${err}`);
      }
    }

    // De-duplicate across chunks
    allPromises = deduplicatePromises(allPromises);

    // Assign sequential promise codes
    for (let i = 0; i < allPromises.length; i++) {
      allPromises[i].promiseCode = `${abbr}-${year}-${String(i + 1).padStart(3, '0')}`;
    }

    // Build output
    const sourceUrl = entry.dnppUrl || entry.pdfUrl || '';
    const output: PartyPromiseFile = {
      party: abbr,
      partySlug: slug,
      program: parsed.chapters.length > 0 ? '' : '', // Will be enriched later
      electionYear: year,
      extractionDate: new Date().toISOString().split('T')[0],
      extractionMethod: `llm-${modelShortName(model)}-v1`,
      sourceUrl,
      pdfHash: parsed.pdfHash || '',
      totalPromises: allPromises.length,
      promises: allPromises.map(p => ({
        promiseCode: p.promiseCode,
        text: p.text,
        summary: p.summary,
        theme: p.theme,
        specificity: p.specificity,
        keywords: p.keywords,
        sourceRef: `Verkiezingsprogramma ${abbr} ${year}, ${p.sourcePages}`,
        originalQuote: p.originalQuote,
      })),
    };

    // Get program title from manifest
    output.program = entry.title || '';

    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`  ✅ ${abbr}: ${allPromises.length} promises → ${outputPath}`);
    totalExtracted += allPromises.length;
  }

  console.log(`\n[EXTRACT] Done: ${totalExtracted} promises extracted, ${totalSkipped} parties skipped`);
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('extract-promises-from-program.ts')) {
  const args = process.argv.slice(2);
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
  const dryRun = args.includes('--dry-run');

  extractPromisesFromPrograms({
    party: partyArg,
    year: yearArg ? parseInt(yearArg) : undefined,
    dryRun,
  }).catch(console.error);
}
