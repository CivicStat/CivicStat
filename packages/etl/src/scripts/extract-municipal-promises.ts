/**
 * Extract municipal verkiezingsbeloften from parsed program JSONs using LLM.
 *
 * Adapted from extract-promises-from-program.ts with:
 * - Municipal theme set (VERKEER, GROEN_KLIMAAT, CULTUUR_SPORT, etc.)
 * - Municipal extraction prompt (gemeentelijke bevoegdheden only)
 * - City-scoped output paths
 *
 * Usage:
 *   npx tsx src/scripts/extract-municipal-promises.ts --city amsterdam
 *   npx tsx src/scripts/extract-municipal-promises.ts --city amsterdam --party PvdA
 *   npx tsx src/scripts/extract-municipal-promises.ts --city den-haag --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAIClient, chatWithRetry, getModel, modelShortName } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'programs', 'municipal');
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises', 'municipal');
const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');

// ─── Municipal Themes ──────────────────────────────────────────

const VALID_MUNICIPAL_THEMES = [
  'WONEN', 'VERKEER', 'GROEN_KLIMAAT', 'VEILIGHEID', 'ONDERWIJS',
  'CULTUUR_SPORT', 'SOCIAAL', 'ECONOMIE', 'JEUGD', 'ZORG',
  'OPENBARE_RUIMTE', 'BESTUUR', 'FINANCIEN', 'DIVERSITEIT',
] as const;

const VALID_SPECIFICITIES = ['SPECIFIEK', 'GEMIDDELD', 'VAAG'] as const;

// ─── Types ─────────────────────────────────────────────────────

interface ParsedProgram {
  party: string;
  partySlug: string;
  fullText: string;
  chapters: Array<{ title: string; startPage: number; endPage: number; text: string }>;
  pageCount: number;
  totalWords: number;
  pdfHash?: string;
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

export interface MunicipalPromiseFile {
  party: string;
  partySlug: string;
  city: string;
  parliamentSlug: string;
  program: string;
  electionYear: number;
  extractionDate: string;
  extractionMethod: string;
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

// ─── Municipal Extraction Prompt ───────────────────────────────

function buildMunicipalExtractionPrompt(party: string, city: string, chunkText: string, year: number): string {
  const cityDisplay = city.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return `Je bent een STRENGE data-extractie-assistent voor CivicStat, een transparantieplatform voor de Nederlandse gemeentepolitiek. Extraheer ALLEEN harde, toetsbare verkiezingsbeloften uit het onderstaande gedeelte van het ${party} verkiezingsprogramma voor de Gemeenteraad van ${cityDisplay} (${year}).

KERNREGEL — KWALITEIT BOVEN KWANTITEIT:
Een gemeentelijk verkiezingsprogramma bevat typisch 30-80 echte, toetsbare beloften. Wees ZEER selectief.

SCOPE — GEMEENTELIJKE BEVOEGDHEDEN ALLEEN:
Extraheer ALLEEN beloften over GEMEENTELIJKE zaken:
- Wonen: sociale huur, nieuwbouw, huisvestingsbeleid, woningtoewijzing
- Verkeer: fiets, tram, metro, bus, parkeren, autoluw, mobiliteit
- Groen & klimaat: parken, energietransitie, afval, bomen, duurzaamheid
- Veiligheid: handhaving, overlast, BOA's, cameratoezicht, veilige wijken
- Onderwijs: basisonderwijs, schoolgebouwen, voorschoolse educatie
- Cultuur & sport: subsidies, sportfaciliteiten, bibliotheken, festivals
- Sociaal: armoede, schuldhulp, WMO, bijstand, mantelzorg, participatie
- Economie: lokale ondernemers, toerisme, horeca, markten, bedrijventerreinen
- Jeugd: jeugdzorg, speelplaatsen, jongerenbeleid, kinderopvang
- Zorg: WMO, GGD, gezondheidsbeleid, ouderenzorg
- Openbare ruimte: straten, pleinen, riolering, waterhuishouding, onderhoud
- Bestuur: burgerparticipatie, stadsdelen, transparantie, digitalisering
- Financiën: OZB, gemeentebelastingen, begroting
- Diversiteit & inclusie: anti-discriminatie, toegankelijkheid, LHBTI+

NIET extraheren:
- Nationale politiek (landelijke belastingen, defensie, migratie, buitenland)
- Beloften over Tweede Kamer, kabinet of landelijke wetgeving
- Lobby-intenties: "wij pleiten bij het Rijk voor..."
- Europese/internationale zaken
- Historische beschrijvingen van behaalde resultaten

TERMINOLOGIE: Wethouder (niet minister), B&W / college (niet kabinet), Gemeenteraad (niet Tweede Kamer), Raadslid (niet Kamerlid), Stadsdeel (niet provincie)

WAT IS WEL EEN BELOFTE:
- "Er komen 5.000 nieuwe sociale huurwoningen voor 2026"
- "De OZB gaat niet omhoog deze raadsperiode"
- "Er komt een nieuw zwembad in Noord"
- "Alle scholen worden voor 2025 verduurzaamd"

WAT IS GEEN BELOFTE (NIET extraheren):
- Waardeverklaringen, diagnoses, vage aspiraties
- Open intenties: "Wij zetten ons in voor...", "Wij streven naar..."
- Containerbegrippen: "een leefbare stad", "veilige wijken" (zonder concreet middel)

CLASSIFICEER specificiteit STRENG:
  - SPECIFIEK: meetbaar getal, deadline, of concreet beleidsinstrument
  - GEMIDDELD: duidelijke beleidsrichting met concreet middel, zonder exact getal
  - VAAG: brede ambitie zonder concreet middel — bij voorkeur NIET extraheren

THEMA — kies uit: WONEN, VERKEER, GROEN_KLIMAAT, VEILIGHEID, ONDERWIJS, CULTUUR_SPORT, SOCIAAL, ECONOMIE, JEUGD, ZORG, OPENBARE_RUIMTE, BESTUUR, FINANCIEN, DIVERSITEIT

KERNWOORDEN: 3-8 inhoudelijke beleidstermen (zelfstandige naamwoorden)

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

// ─── Validation ─────────────────────────────────────────────────

function validateMunicipalPromise(p: any): ExtractedPromise | null {
  if (!p.text || !p.summary || !p.theme) return null;

  // Validate theme
  const theme = p.theme.toUpperCase();
  if (!VALID_MUNICIPAL_THEMES.includes(theme as any)) {
    // Try mapping national themes to municipal equivalents
    const THEME_MAP: Record<string, string> = {
      'KLIMAAT': 'GROEN_KLIMAAT',
      'LANDBOUW': 'GROEN_KLIMAAT',
      'MIGRATIE': 'DIVERSITEIT',
      'DEFENSIE': 'BESTUUR',
      'BUITENLAND': 'BESTUUR',
    };
    const mapped = THEME_MAP[theme];
    if (mapped) {
      console.log(`    ↔ Remapped theme ${theme} → ${mapped}`);
      p.theme = mapped;
    } else {
      console.warn(`    ⚠ Invalid municipal theme "${p.theme}", skipping`);
      return null;
    }
  }

  // Validate specificity
  const specificity = (p.specificity || 'GEMIDDELD').toUpperCase();
  const finalSpecificity = VALID_SPECIFICITIES.includes(specificity as any) ? specificity : 'GEMIDDELD';

  // Filter VAAG promises
  if (finalSpecificity === 'VAAG') {
    console.log(`    🔻 Filtered VAAG: "${p.summary?.slice(0, 60)}..."`);
    return null;
  }

  // Minimum quality
  const text = p.text.trim();
  if (text.length < 20) {
    console.log(`    🔻 Filtered too-short promise (${text.length} chars): "${text}"`);
    return null;
  }

  return {
    promiseCode: '',
    text,
    summary: p.summary.trim(),
    theme: (p.theme || theme).toUpperCase(),
    specificity: finalSpecificity as ExtractedPromise['specificity'],
    keywords: Array.isArray(p.keywords) ? p.keywords.map((k: any) => String(k).toLowerCase()) : [],
    sourcePages: p.sourcePages || '',
    originalQuote: p.originalQuote || p.text || '',
  };
}

// ─── Text Chunking ──────────────────────────────────────────────

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

// ─── De-duplication ─────────────────────────────────────────────

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
    const isDupe = unique.some((existing) => jaccardSimilarity(existing.summary, p.summary) > 0.6);
    if (!isDupe) {
      unique.push(p);
    } else {
      console.log(`    🔄 Dedup: skipping "${p.summary.slice(0, 60)}..."`);
    }
  }
  return unique;
}

// ─── City code helper ───────────────────────────────────────────

function cityCode(slug: string): string {
  const codes: Record<string, string> = {
    amsterdam: 'AMS',
    'den-haag': 'DH',
    rotterdam: 'RTD',
    utrecht: 'UTR',
  };
  return codes[slug] || slug.slice(0, 3).toUpperCase();
}

// ─── Main Extraction ────────────────────────────────────────────

export interface ExtractMunicipalOptions {
  city?: string;
  party?: string;
  dryRun?: boolean;
}

export async function extractMunicipalPromises(options: ExtractMunicipalOptions = {}): Promise<void> {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Municipal manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  // Initialize AI client
  const model = getModel('extract');
  let ai: AIClient | null = null;
  if (!options.dryRun) {
    ai = createAIClient();
  }

  console.log(`\n[EXTRACT-MUNICIPAL] Municipal promise extraction (city=${options.city || 'all'}, party=${options.party || 'all'}, dryRun=${options.dryRun || false})`);
  if (ai) {
    console.log(`[EXTRACT-MUNICIPAL] Provider: ${ai.provider} | Model: ${modelShortName(model)}`);
  }
  console.log();

  // Filter cities
  const cityKeys = options.city
    ? Object.keys(manifest.programs).filter((k) => k.includes(options.city!))
    : Object.keys(manifest.programs);

  let grandTotalExtracted = 0;
  let grandTotalSkipped = 0;

  for (const cityKey of cityKeys) {
    const cityData = manifest.programs[cityKey];
    const slug = cityData.parliamentSlug;
    const cityDir = join(DATA_DIR, slug);
    const promisesDir = join(PROMISES_DIR, slug);

    console.log(`\n[EXTRACT-MUNICIPAL] === ${cityData.election} ===`);

    // Filter parties
    const parties = options.party
      ? cityData.parties.filter((p: any) => p.abbreviation === options.party || p.partySlug === options.party?.toLowerCase())
      : cityData.parties;

    let totalExtracted = 0;
    let totalSkipped = 0;

    for (const entry of parties) {
      const abbr = entry.abbreviation;
      const partySlug = entry.partySlug;
      const parsedPath = join(cityDir, `${partySlug}_${slug}_2022-parsed.json`);

      if (!existsSync(parsedPath)) {
        console.log(`  ⏭ ${abbr}: No parsed JSON found — run 'parse-municipal-programs' first`);
        totalSkipped++;
        continue;
      }

      // Check existing output
      const outputPath = join(promisesDir, `${partySlug}-${slug}-2022.json`);
      if (existsSync(outputPath) && !options.dryRun) {
        const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
        console.log(`  ⏭ ${abbr}: Already extracted (${existing.totalPromises} promises). Delete to re-extract.`);
        totalSkipped++;
        continue;
      }

      console.log(`\n  🔍 Extracting promises from ${abbr} (${slug})...`);
      const parsed: ParsedProgram = JSON.parse(readFileSync(parsedPath, 'utf-8'));

      // Split into chunks
      const chunks = splitIntoChunks(parsed.chapters);

      if (options.dryRun) {
        console.log(`    [DRY RUN] Would extract from ${chunks.length} chunks (${parsed.chapters.length} chapters, ${parsed.totalWords} words)`);
        for (const ch of chunks) {
          const words = ch.text.split(/\s+/).length;
          console.log(`      - "${ch.title}" (${words} words)`);
        }
        continue;
      }

      let allPromises: ExtractedPromise[] = [];
      let chunkIdx = 0;

      for (const chunk of chunks) {
        chunkIdx++;
        const words = chunk.text.split(/\s+/).length;

        if (words < 100) {
          console.log(`    ⏭ Chunk "${chunk.title}" too short (${words} words), skipping`);
          continue;
        }

        console.log(`    📄 Chunk ${chunkIdx}/${chunks.length}: "${chunk.title}" (${words} words)`);

        try {
          const prompt = buildMunicipalExtractionPrompt(abbr, slug, chunk.text, 2022);
          const aiResponse = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
            traceName: 'extract-municipal-promises',
            traceTags: ['etl', 'extract-municipal-promises', abbr, slug],
          });
          const response = aiResponse.text;

          // Parse JSON response
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
            const validated = validateMunicipalPromise(raw);
            if (validated) {
              allPromises.push(validated);
              validCount++;
            }
          }

          console.log(`    ✅ ${validCount} promises extracted from chunk`);

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`    ❌ Failed to extract from chunk "${chunk.title}": ${err}`);
        }
      }

      // De-duplicate
      allPromises = deduplicatePromises(allPromises);

      // Assign codes: PvdA-AMS-2022-001
      const code = cityCode(slug);
      for (let i = 0; i < allPromises.length; i++) {
        allPromises[i].promiseCode = `${abbr}-${code}-2022-${String(i + 1).padStart(3, '0')}`;
      }

      // Build output
      const output: MunicipalPromiseFile = {
        party: abbr,
        partySlug,
        city: slug,
        parliamentSlug: slug,
        program: entry.title || '',
        electionYear: 2022,
        extractionDate: new Date().toISOString().split('T')[0],
        extractionMethod: `llm-${modelShortName(model)}-v1`,
        totalPromises: allPromises.length,
        promises: allPromises.map((p) => ({
          promiseCode: p.promiseCode,
          text: p.text,
          summary: p.summary,
          theme: p.theme,
          specificity: p.specificity,
          keywords: p.keywords,
          sourceRef: `Verkiezingsprogramma ${abbr} ${slug} 2022, ${p.sourcePages}`,
          originalQuote: p.originalQuote,
        })),
      };

      writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`  ✅ ${abbr}: ${allPromises.length} promises → ${outputPath}`);
      totalExtracted += allPromises.length;
    }

    console.log(`\n[EXTRACT-MUNICIPAL] ${slug}: ${totalExtracted} promises extracted, ${totalSkipped} skipped`);
    grandTotalExtracted += totalExtracted;
    grandTotalSkipped += totalSkipped;
  }

  console.log(`\n[EXTRACT-MUNICIPAL] Grand total: ${grandTotalExtracted} promises extracted, ${grandTotalSkipped} skipped`);
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('extract-municipal-promises.ts')) {
  const args = process.argv.slice(2);
  const cityArg = args.includes('--city') ? args[args.indexOf('--city') + 1] : undefined;
  const partyArg = args.includes('--party') ? args[args.indexOf('--party') + 1] : undefined;
  const dryRun = args.includes('--dry-run');

  extractMunicipalPromises({ city: cityArg, party: partyArg, dryRun }).catch(console.error);
}
