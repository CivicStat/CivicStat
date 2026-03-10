/**
 * Municipal Promise Extraction — 2026 Gemeenteraadsverkiezingen
 *
 * Extracts actionable election promises from municipal verkiezingsprogramma PDFs
 * (Amsterdam + Den Haag) using Claude via the unified AI client.
 *
 * Usage:
 *   npx tsx src/scripts/extract-municipal-promises-2026.ts --city amsterdam
 *   npx tsx src/scripts/extract-municipal-promises-2026.ts --city den-haag
 *   npx tsx src/scripts/extract-municipal-promises-2026.ts --city amsterdam --party vvd
 *   npx tsx src/scripts/extract-municipal-promises-2026.ts --city all
 *   npx tsx src/scripts/extract-municipal-promises-2026.ts --city amsterdam --party vvd --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAIClient, chatWithRetry, getModel, modelShortName } from '../lib/ai-client.js';
import type { AIClient } from '../lib/ai-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const PROGRAMS_DIR = join(DATA_DIR, 'programs', 'municipal');
const PROMISES_DIR = join(DATA_DIR, 'promises', 'municipal');

// ─── Party Mappings ──────────────────────────────────────────

interface PartyMapping {
  slug: string;
  file: string;
  name: string;
}

const AMSTERDAM_2026_PARTIES: PartyMapping[] = [
  { slug: 'groenlinks', file: 'groenlinks_amsterdam_2026.pdf', name: 'GroenLinks' },
  { slug: 'pvda', file: 'pvda_amsterdam_2026.pdf', name: 'PvdA' },
  { slug: 'pvdd', file: 'pvdd_amsterdam_2026.pdf', name: 'Partij voor de Dieren' },
  { slug: 'sp', file: 'sp_amsterdam_2026.pdf', name: 'SP' },
  { slug: 'cda', file: 'cda_amsterdam_2026.pdf', name: 'CDA' },
  { slug: 'denk', file: 'denk_amsterdam_2026.pdf', name: 'DENK' },
  { slug: 'd66', file: 'd66_amsterdam_2026.pdf', name: 'D66' },
  { slug: 'volt', file: 'volt_amsterdam_2026.pdf', name: 'Volt' },
  { slug: 'vvd', file: 'vvd_amsterdam_2026.pdf', name: 'VVD' },
];

const DEN_HAAG_2026_PARTIES: PartyMapping[] = [
  { slug: 'd66', file: 'd66_den-haag_2026.pdf', name: 'D66' },
  { slug: 'volt', file: 'volt_den-haag_2026.pdf', name: 'Volt' },
  { slug: 'vvd', file: 'vvd_den-haag_2026.pdf', name: 'VVD' },
  { slug: 'denk', file: 'denk_den-haag_2026.pdf', name: 'DENK' },
  { slug: 'hart-voor-den-haag', file: 'hart-voor-den-haag_den-haag_2026.pdf', name: 'Hart voor Den Haag' },
  { slug: 'cda', file: 'cda_den-haag_2026.pdf', name: 'CDA' },
  { slug: 'groenlinks-pvda', file: 'groenlinks_den-haag_2026.pdf', name: 'GroenLinks-PvdA' },
  { slug: 'pvdd', file: 'pvdd_den-haag_2026.pdf', name: 'Partij voor de Dieren' },
  { slug: 'sp', file: 'sp_den-haag_2026.pdf', name: 'SP' },
];

const CITY_CONFIG: Record<string, { parties: PartyMapping[]; dir: string; parliamentSlug: string }> = {
  amsterdam: {
    parties: AMSTERDAM_2026_PARTIES,
    dir: 'amsterdam-2026',
    parliamentSlug: 'amsterdam',
  },
  'den-haag': {
    parties: DEN_HAAG_2026_PARTIES,
    dir: 'den-haag-2026',
    parliamentSlug: 'den-haag',
  },
};

// ─── Theme Mapping (extraction slug → Prisma enum) ──────────

const THEME_MAP: Record<string, string> = {
  'wonen': 'WONEN',
  'verkeer-vervoer': 'VERKEER',
  'groen-klimaat': 'GROEN_KLIMAAT',
  'veiligheid': 'VEILIGHEID',
  'onderwijs': 'ONDERWIJS',
  'cultuur': 'CULTUUR_SPORT',
  'sociaal-domein': 'SOCIAAL',
  'economie': 'ECONOMIE',
  'jeugd': 'JEUGD',
  'openbare-ruimte': 'OPENBARE_RUIMTE',
  'financien': 'FINANCIEN',
  'bestuur-democratie': 'BESTUUR',
};

// ─── Types ───────────────────────────────────────────────────

interface ExtractedPromise {
  text: string;
  originalText: string;
  theme: string;
  specificity: 'HIGH' | 'MEDIUM';
  verifiable: boolean;
  keywords: string[];
}

interface PromiseOutputFile {
  party: string;
  partySlug: string;
  city: string;
  parliamentSlug: string;
  program: string;
  electionYear: number;
  sourceFile: string;
  extractedAt: string;
  extractedBy: string;
  promises: ExtractedPromise[];
}

// ─── PDF Parsing ─────────────────────────────────────────────

let pdfParse: any;

async function parsePdf(pdfPath: string): Promise<string> {
  if (!pdfParse) {
    // Import pdf-parse/lib to avoid the test-file-loading bug in v1.x index.js
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = typeof mod.default === 'function' ? mod.default : mod;
  }
  const buffer = readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ─── Chunking (~2000 words) ──────────────────────────────────

function splitIntoChunks(text: string, maxWords: number = 2000): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).filter(Boolean).length;

    if (currentWords + paraWords > maxWords && current.length > 0) {
      chunks.push(current.trim());
      current = '';
      currentWords = 0;
    }

    current += para + '\n\n';
    currentWords += paraWords;
  }

  if (current.trim().length > 50) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ─── Extraction Prompt ───────────────────────────────────────

function buildPrompt(party: string, city: string, passageText: string): string {
  return `Je bent een neutrale data-extractie-assistent voor CivicStat, een politiek transparantieplatform.

Extraheer CONCRETE gemeentelijke verkiezingsbeloften uit de volgende passage van het verkiezingsprogramma van ${party} voor ${city} (gemeenteraadsverkiezingen 2026).

REGELS:
1. Extraheer ALLEEN concrete beloften die de gemeenteraad of het college kan waarmaken. Geen landelijke thema's, geen vage aspiraties.
2. Een goede belofte bevat een ACTIE (bouwen, verlagen, investeren, stoppen, uitbreiden) + een ONDERWERP (woningen, belasting, park, fietspad, etc.)
3. NIET extraheren: vage missie-statements ("wij staan voor een groene stad"), intenties zonder actie ("wij vinden veiligheid belangrijk"), of landelijke politieke standpunten die niet via de gemeenteraad gaan.
4. Normaliseer elke belofte tot max 60 woorden in het Nederlands.
5. Geef per belofte de ORIGINELE tekst uit het programma (max 120 woorden).
6. Kies een theme uit de volgende lijst:
   - wonen (sociale huur, koopwoningen, bouwplannen, huurdersrechten)
   - verkeer-vervoer (fiets, OV, parkeren, autoluwe zones, metro, tram)
   - groen-klimaat (parken, energietransitie, warmtenet, circulaire economie, bomen)
   - veiligheid (politie, handhaving, camera's, straatintimidatie, criminaliteit)
   - onderwijs (scholen, kinderopvang, leerlingenzorg, volwasseneneducatie)
   - cultuur (musea, theater, subsidies, nachtleven, erfgoed)
   - sociaal-domein (armoedebestrijding, WMO, bijstand, schuldhulp, integratie)
   - economie (MKB, toerisme, werkgelegenheid, startups, winkelgebieden)
   - jeugd (jeugdzorg, speeltuinen, jongerenwerk, sportfaciliteiten)
   - openbare-ruimte (afvalinzameling, schoonmaak, onderhoud, straatmeubilair)
   - financien (OZB, gemeentelijke belastingen, begrotingsdiscipline)
   - bestuur-democratie (burgerparticipatie, transparantie, wijkraden)
7. Geef specificity:
   - HIGH: meetbaar of concreet getal ("2000 nieuwe woningen", "OZB met 10% verlagen")
   - MEDIUM: duidelijke richting maar niet meetbaar ("meer sociale huurwoningen bouwen", "investeren in fietsinfrastructuur")
   - LOW: richting zonder detail ("de stad veiliger maken") — extraheer deze NIET
8. Geef verifiable: true als het objectief getoetst kan worden na 4 jaar, anders false.

ANTWOORD UITSLUITEND in JSON-formaat, geen markdown, geen toelichting:
{
  "promises": [
    {
      "text": "genormaliseerde belofte",
      "originalText": "originele tekst uit programma",
      "theme": "theme-slug",
      "specificity": "HIGH" | "MEDIUM",
      "verifiable": true | false,
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Als er geen concrete beloften in deze passage staan, antwoord dan: {"promises": []}

PASSAGE:
${passageText}`;
}

// ─── Validation ──────────────────────────────────────────────

const VALID_THEMES = new Set(Object.keys(THEME_MAP));
const VALID_SPECIFICITIES = new Set(['HIGH', 'MEDIUM']);

function validatePromise(raw: any): ExtractedPromise | null {
  if (!raw.text || typeof raw.text !== 'string') return null;

  const text = raw.text.trim();
  if (text.length < 15) return null;

  // Validate theme
  const theme = (raw.theme || '').toLowerCase();
  if (!VALID_THEMES.has(theme)) {
    console.warn(`      ⚠ Invalid theme "${raw.theme}", skipping`);
    return null;
  }

  // Validate specificity
  const spec = (raw.specificity || '').toUpperCase();
  if (!VALID_SPECIFICITIES.has(spec)) {
    if (spec === 'LOW') {
      // LOW specificity = too vague, skip
      return null;
    }
    console.warn(`      ⚠ Invalid specificity "${raw.specificity}", defaulting to MEDIUM`);
  }

  return {
    text,
    originalText: (raw.originalText || raw.text || '').trim().slice(0, 500),
    theme,
    specificity: VALID_SPECIFICITIES.has(spec) ? spec as 'HIGH' | 'MEDIUM' : 'MEDIUM',
    verifiable: typeof raw.verifiable === 'boolean' ? raw.verifiable : false,
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.map((k: any) => String(k).toLowerCase()).slice(0, 8)
      : [],
  };
}

// ─── De-duplication ──────────────────────────────────────────

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
    const isDupe = unique.some(existing => jaccardSimilarity(existing.text, p.text) > 0.55);
    if (!isDupe) {
      unique.push(p);
    }
  }
  return unique;
}

// ─── Main Extraction ─────────────────────────────────────────

interface ExtractOptions {
  city: string;
  party?: string;
  dryRun?: boolean;
}

export async function extractMunicipalPromises(options: ExtractOptions): Promise<void> {
  const cities = options.city === 'all' ? ['amsterdam', 'den-haag'] : [options.city];
  const model = process.env.AI_MODEL_EXTRACT || 'anthropic/claude-sonnet-4';

  let ai: AIClient | null = null;
  if (!options.dryRun) {
    ai = createAIClient();
  }

  console.log(`\n[EXTRACT-MUNICIPAL] Municipal promise extraction 2026`);
  console.log(`  Cities: ${cities.join(', ')}`);
  console.log(`  Party filter: ${options.party || 'all'}`);
  console.log(`  Model: ${modelShortName(model)}`);
  console.log(`  Dry run: ${options.dryRun || false}\n`);

  let grandTotalPromises = 0;

  for (const city of cities) {
    const config = CITY_CONFIG[city];
    if (!config) {
      console.error(`  Unknown city: ${city}`);
      continue;
    }

    const pdfDir = join(PROGRAMS_DIR, config.dir);
    const outDir = join(PROMISES_DIR, config.dir);

    if (!existsSync(pdfDir)) {
      console.error(`  PDF directory not found: ${pdfDir}`);
      continue;
    }

    // Create output directory
    mkdirSync(outDir, { recursive: true });

    const parties = options.party
      ? config.parties.filter(p => p.slug === options.party)
      : config.parties;

    if (parties.length === 0) {
      console.log(`  No parties found matching filter "${options.party}" in ${city}`);
      continue;
    }

    console.log(`  📍 ${city.toUpperCase()} — ${parties.length} parties\n`);

    for (const party of parties) {
      const pdfPath = join(pdfDir, party.file);
      const outputPath = join(outDir, `${party.slug}_${city.replace(/ /g, '-')}_2026.json`);

      // Checkpoint: skip if output already exists
      if (existsSync(outputPath) && !options.dryRun) {
        const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
        console.log(`    ⏭ ${party.name}: Already extracted (${existing.promises.length} promises). Delete to re-extract.`);
        grandTotalPromises += existing.promises.length;
        continue;
      }

      if (!existsSync(pdfPath)) {
        console.warn(`    ⚠ ${party.name}: PDF not found: ${pdfPath}`);
        continue;
      }

      const fileSize = readFileSync(pdfPath).length;
      console.log(`    📄 ${party.name} (${(fileSize / 1024).toFixed(0)} KB)`);

      // Parse PDF
      let fullText: string;
      try {
        fullText = await parsePdf(pdfPath);
      } catch (err) {
        console.error(`    ❌ ${party.name}: PDF parse failed: ${err}`);
        continue;
      }

      const totalWords = fullText.split(/\s+/).filter(Boolean).length;
      console.log(`      ${totalWords} words extracted from PDF`);

      if (totalWords < 50) {
        console.warn(`      ⚠ Very little text extracted — PDF may be image-based or corrupt`);
        if (totalWords < 10) continue;
      }

      // Split into chunks
      const chunks = splitIntoChunks(fullText);
      console.log(`      Split into ${chunks.length} chunks`);

      if (options.dryRun) {
        for (let i = 0; i < Math.min(chunks.length, 3); i++) {
          const words = chunks[i].split(/\s+/).filter(Boolean).length;
          console.log(`        Chunk ${i + 1}: ${words} words`);
        }
        if (chunks.length > 3) console.log(`        ... and ${chunks.length - 3} more`);
        continue;
      }

      // Extract promises from each chunk
      let allPromises: ExtractedPromise[] = [];
      const cityDisplay = city === 'den-haag' ? 'Den Haag' : 'Amsterdam';

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkWords = chunk.split(/\s+/).filter(Boolean).length;

        // Skip very short chunks
        if (chunkWords < 60) {
          console.log(`      ⏭ Chunk ${i + 1}/${chunks.length}: too short (${chunkWords} words)`);
          continue;
        }

        console.log(`      🔍 Chunk ${i + 1}/${chunks.length} (${chunkWords} words)...`);

        try {
          const prompt = buildPrompt(party.name, cityDisplay, chunk);
          const response = await chatWithRetry(ai!, model, prompt, { maxTokens: 8192 }, {
            traceName: 'extract-municipal-promises',
            traceTags: ['etl', 'municipal-2026', party.slug, city],
          });

          // Parse JSON response
          let jsonStr = response.text.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }

          const parsed = JSON.parse(jsonStr);
          const rawPromises = parsed.promises || parsed;

          if (!Array.isArray(rawPromises)) {
            console.warn(`      ⚠ Expected array, got ${typeof rawPromises}`);
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

          console.log(`      ✅ ${validCount} promises from chunk ${i + 1}`);

          // Rate limiting
          await new Promise(r => setTimeout(r, 1500));
        } catch (err: any) {
          console.error(`      ❌ Chunk ${i + 1} failed: ${err.message || err}`);
          // Continue with next chunk
        }
      }

      // De-duplicate across chunks
      const beforeDedup = allPromises.length;
      allPromises = deduplicatePromises(allPromises);
      if (beforeDedup !== allPromises.length) {
        console.log(`      🔄 Dedup: ${beforeDedup} → ${allPromises.length}`);
      }

      // Write output
      const output: PromiseOutputFile = {
        party: party.name,
        partySlug: party.slug,
        city,
        parliamentSlug: config.parliamentSlug,
        program: `Verkiezingsprogramma ${party.name} ${cityDisplay} 2026`,
        electionYear: 2026,
        sourceFile: party.file,
        extractedAt: new Date().toISOString(),
        extractedBy: `llm:${modelShortName(model)}`,
        promises: allPromises,
      };

      writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`    ✅ ${party.name}: ${allPromises.length} promises → ${outputPath}\n`);
      grandTotalPromises += allPromises.length;
    }
  }

  console.log(`\n[EXTRACT-MUNICIPAL] Done. Total: ${grandTotalPromises} promises extracted.\n`);
}

// ─── CLI ─────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('extract-municipal-promises-2026.ts')) {
  const args = process.argv.slice(2);

  const cityIdx = args.indexOf('--city');
  const city = cityIdx >= 0 ? args[cityIdx + 1] : undefined;

  const partyIdx = args.indexOf('--party');
  const party = partyIdx >= 0 ? args[partyIdx + 1] : undefined;

  const dryRun = args.includes('--dry-run');

  if (!city) {
    console.error('Usage: npx tsx src/scripts/extract-municipal-promises-2026.ts --city <amsterdam|den-haag|all> [--party <slug>] [--dry-run]');
    process.exit(1);
  }

  extractMunicipalPromises({ city, party, dryRun }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
