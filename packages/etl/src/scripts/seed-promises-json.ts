/**
 * Seed promises from extracted JSON files into the database.
 *
 * Reads JSON files from data/promises/{party}-tk{year}.json
 * and upserts them into the promises table.
 *
 * Unlike the hardcoded seed files (seeds/*-promises-tk2023.ts),
 * this seeder works from JSON output of the extraction pipeline
 * and does NOT require pre-existing passage IDs.
 *
 * Specificity mapping (Dutch → Prisma enum):
 *   SPECIFIEK → CONCRETE
 *   GEMIDDELD → DIRECTIONAL
 *   VAAG      → VAGUE
 *
 * Usage:
 *   npx tsx src/scripts/seed-promises-json.ts                    # All parties
 *   npx tsx src/scripts/seed-promises-json.ts --party VVD        # Only VVD
 *   npx tsx src/scripts/seed-promises-json.ts --dry-run           # Preview only
 *   npx tsx src/scripts/seed-promises-json.ts --replace           # Delete existing before seeding
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises');

const prisma = new PrismaClient();

// ─── Types (matches PartyPromiseFile from extract-promises) ─────

interface PromiseFileEntry {
  promiseCode: string;
  text: string;
  summary: string;
  theme: string;
  specificity: string;         // Dutch: SPECIFIEK | GEMIDDELD | VAAG
  keywords: string[];
  sourceRef: string;
  originalQuote?: string;
}

interface PromiseFile {
  party: string;               // "VVD"
  partySlug: string;           // "vvd"
  program: string;             // "Ruimte geven. Grenzen stellen."
  electionYear: number;
  extractionDate: string;
  extractionMethod: string;    // "llm-claude-sonnet-v1"
  sourceUrl: string;
  pdfHash: string;
  totalPromises: number;
  promises: PromiseFileEntry[];
}

// ─── Specificity Mapping (Dutch → Prisma enum) ─────────────────

const SPECIFICITY_MAP: Record<string, string> = {
  'SPECIFIEK': 'CONCRETE',
  'GEMIDDELD': 'DIRECTIONAL',
  'VAAG': 'VAGUE',
  // Also accept English values as passthrough
  'CONCRETE': 'CONCRETE',
  'DIRECTIONAL': 'DIRECTIONAL',
  'VAGUE': 'VAGUE',
};

function mapSpecificity(input: string): string {
  const mapped = SPECIFICITY_MAP[input.toUpperCase()];
  if (!mapped) {
    console.warn(`  ⚠ Unknown specificity "${input}", defaulting to DIRECTIONAL`);
    return 'DIRECTIONAL';
  }
  return mapped;
}

// ─── Theme Mapping (passthrough, but validate) ──────────────────

const VALID_THEMES = new Set([
  // National
  'DEFENSIE', 'WONEN', 'MIGRATIE', 'KLIMAAT', 'ZORG',
  'ONDERWIJS', 'ECONOMIE', 'VEILIGHEID', 'BESTUUR', 'SOCIAAL',
  'LANDBOUW', 'BUITENLAND',
  // Municipal
  'VERKEER', 'GROEN_KLIMAAT', 'CULTUUR_SPORT', 'JEUGD',
  'OPENBARE_RUIMTE', 'FINANCIEN', 'DIVERSITEIT',
]);

function mapTheme(input: string): string {
  const upper = input.toUpperCase();
  if (!VALID_THEMES.has(upper)) {
    console.warn(`  ⚠ Unknown theme "${input}", defaulting to BESTUUR`);
    return 'BESTUUR';
  }
  return upper;
}

// ─── Party Aliases (same as in programmas.ts) ───────────────────

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

// ─── Find Party ─────────────────────────────────────────────────

async function findParty(abbreviation: string) {
  const aliases = PARTY_ALIASES[abbreviation] || [];
  const searchTerms = [abbreviation, ...aliases];

  const party = await prisma.party.findFirst({
    where: {
      OR: [
        ...searchTerms.map(term => ({ abbreviation: term })),
        ...searchTerms.map(term => ({ name: term })),
      ],
    },
  });

  return party;
}

// ─── Find Program ───────────────────────────────────────────────

async function findProgram(partyId: string, year: number, programType: string = 'VERKIEZINGSPROGRAMMA') {
  return prisma.program.findFirst({
    where: {
      partyId,
      electionYear: year,
      programType: programType as any,
    },
  });
}

// ─── Seed Logic ─────────────────────────────────────────────────

interface SeedOptions {
  party?: string;
  year?: number;
  dryRun?: boolean;
  replace?: boolean;
}

export async function seedPromisesFromJson(options: SeedOptions = {}): Promise<void> {
  const year = options.year ?? 2023;
  console.log(`\n[SEED-JSON] Seeding promises from JSON (year=${year}, party=${options.party || 'all'}, dryRun=${options.dryRun || false})...\n`);

  if (!existsSync(PROMISES_DIR)) {
    throw new Error(`Promises directory not found: ${PROMISES_DIR}`);
  }

  // Find JSON files to process
  const pattern = options.party
    ? [`${options.party.toLowerCase()}-tk${year}.json`]
    : readdirSync(PROMISES_DIR).filter(f => f.endsWith(`-tk${year}.json`));

  if (pattern.length === 0) {
    console.log('[SEED-JSON] No promise JSON files found. Run extract-promises first.');
    return;
  }

  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    for (const filename of pattern) {
      const filePath = join(PROMISES_DIR, filename);
      if (!existsSync(filePath)) {
        console.log(`  ⏭ File not found: ${filePath}`);
        totalSkipped++;
        continue;
      }

      const data: PromiseFile = JSON.parse(readFileSync(filePath, 'utf-8'));
      const abbr = data.party;
      console.log(`  📂 ${abbr}: ${data.totalPromises} promises from ${filename}`);

      if (options.dryRun) {
        // Preview themes distribution
        const themes: Record<string, number> = {};
        const specs: Record<string, number> = {};
        for (const p of data.promises) {
          themes[mapTheme(p.theme)] = (themes[mapTheme(p.theme)] || 0) + 1;
          specs[mapSpecificity(p.specificity)] = (specs[mapSpecificity(p.specificity)] || 0) + 1;
        }
        console.log(`    Themes: ${Object.entries(themes).map(([k, v]) => `${k}:${v}`).join(', ')}`);
        console.log(`    Specificity (mapped): ${Object.entries(specs).map(([k, v]) => `${k}:${v}`).join(', ')}`);
        continue;
      }

      // Find party & program
      const party = await findParty(abbr);
      if (!party) {
        console.log(`  ❌ ${abbr}: Party not found in DB. Run fracties ingest first.`);
        totalFailed++;
        continue;
      }

      const program = await findProgram(party.id, year);
      if (!program) {
        console.log(`  ❌ ${abbr}: Program not found for year ${year}. Run programs ingest first.`);
        totalFailed++;
        continue;
      }

      // Optionally delete existing promises for this program
      if (options.replace) {
        const deleted = await prisma.promise.deleteMany({
          where: { programId: program.id },
        });
        console.log(`    🗑 Deleted ${deleted.count} existing promises for ${abbr}`);
      }

      let seeded = 0;
      for (const promise of data.promises) {
        try {
          const mappedTheme = mapTheme(promise.theme);
          const mappedSpecificity = mapSpecificity(promise.specificity);

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
              theme: mappedTheme as any,
              specificity: mappedSpecificity as any,
              keywords: promise.keywords,
              sourceRef: promise.sourceRef || null,
              extractedBy: 'llm-claude-sonnet-v1',
            },
            create: {
              programId: program.id,
              promiseCode: promise.promiseCode,
              text: promise.text,
              summary: promise.summary,
              theme: mappedTheme as any,
              specificity: mappedSpecificity as any,
              keywords: promise.keywords,
              sourceRef: promise.sourceRef || null,
              passageId: null,    // New JSON-based promises don't link to passages
              expectedVoteDirection: 'VOOR',
              extractedBy: 'llm-claude-sonnet-v1',
            },
          });
          seeded++;
        } catch (err) {
          console.error(`    ❌ Failed to seed ${promise.promiseCode}: ${err}`);
        }
      }

      console.log(`  ✅ ${abbr}: ${seeded} promises seeded (llm-claude-sonnet-v1)`);
      totalSeeded += seeded;
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!options.dryRun) {
    console.log(`\n[SEED-JSON] Done: ${totalSeeded} seeded, ${totalSkipped} skipped, ${totalFailed} failed`);
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-promises-json.ts')) {
  const args = process.argv.slice(2);
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');

  seedPromisesFromJson({
    party: partyArg,
    year: yearArg ? parseInt(yearArg) : undefined,
    dryRun,
    replace,
  }).catch(console.error);
}
