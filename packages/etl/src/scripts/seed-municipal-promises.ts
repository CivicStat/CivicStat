/**
 * Seed municipal promises from extracted JSON files into the database.
 *
 * Reads JSON files from data/promises/municipal/{city}/{party}-{city}-2022.json
 * and upserts them into the promises table, linked to the correct parliament + party.
 *
 * Flow:
 *  1. Find the Parliament by slug (e.g. "amsterdam")
 *  2. Find each Party within that parliament
 *  3. Ensure a Program record exists for the party + year + parliament
 *  4. Upsert promises from the JSON file
 *
 * Usage:
 *   npx tsx src/scripts/seed-municipal-promises.ts --city amsterdam
 *   npx tsx src/scripts/seed-municipal-promises.ts --city den-haag --party PvdA
 *   npx tsx src/scripts/seed-municipal-promises.ts --city amsterdam --dry-run
 *   npx tsx src/scripts/seed-municipal-promises.ts --city amsterdam --replace
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises', 'municipal');
const MANIFEST_PATH = join(__dirname, '..', '..', 'data', 'programs', 'municipal', 'manifest.json');

const prisma = new PrismaClient();

// ─── Types (matches MunicipalPromiseFile from extract-municipal-promises) ───

interface MunicipalPromiseEntry {
  promiseCode: string;
  text: string;
  summary: string;
  theme: string;
  specificity: string;
  keywords: string[];
  sourceRef: string;
  originalQuote?: string;
}

interface MunicipalPromiseFile {
  party: string;
  partySlug: string;
  program: string;
  electionYear: number;
  city: string;
  parliamentSlug: string;
  extractionDate: string;
  extractionMethod: string;
  sourceUrl: string;
  pdfHash: string;
  totalPromises: number;
  promises: MunicipalPromiseEntry[];
}

// ─── Specificity Mapping (Dutch → Prisma enum) ────────────────────────────

const SPECIFICITY_MAP: Record<string, string> = {
  'SPECIFIEK': 'CONCRETE',
  'GEMIDDELD': 'DIRECTIONAL',
  'VAAG': 'VAGUE',
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

// ─── Theme Validation (national + municipal themes) ──────────────────────

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

// ─── Municipal Party Aliases (used when matching abbreviation → DB party) ──

const MUNICIPAL_PARTY_ALIASES: Record<string, string[]> = {
  'GroenLinks': ['GroenLinks', 'GL'],
  'PvdA': ['PvdA', 'Partij van de Arbeid'],
  'PvdD': ['PvdD', 'Partij voor de Dieren'],
  'CDA': ['CDA', 'Christen-Democratisch Appèl'],
  'FvD': ['FvD', 'Forum voor Democratie'],
  'DENK': ['DENK'],
  'JA21': ['JA21'],
  'Volt': ['Volt', 'Volt Nederland'],
  'SP': ['SP', 'Socialistische Partij'],
  'VVD': ['VVD'],
  'D66': ['D66', 'Democraten 66'],
  'ChristenUnie-SGP': ['ChristenUnie-SGP', 'CU-SGP', 'ChristenUnie/SGP'],
  'Hart voor Den Haag': ['Hart voor Den Haag', 'Hart voor Den Haag / Groep de Mos'],
  'BIJ1': ['BIJ1'],
  'PVV': ['PVV', 'Partij voor de Vrijheid'],
  'Haagse Stadspartij': ['Haagse Stadspartij', 'HSP'],
};

// ─── Find Party within Parliament ──────────────────────────────────────────

async function findPartyInParliament(abbreviation: string, parliamentId: string) {
  const aliases = MUNICIPAL_PARTY_ALIASES[abbreviation] || [];
  const searchTerms = [abbreviation, ...aliases];

  const party = await prisma.party.findFirst({
    where: {
      parliamentId,
      OR: [
        ...searchTerms.map(term => ({ abbreviation: { equals: term, mode: 'insensitive' as const } })),
        ...searchTerms.map(term => ({ name: { equals: term, mode: 'insensitive' as const } })),
      ],
    },
  });

  return party;
}

// ─── Ensure Program Exists ─────────────────────────────────────────────────

async function ensureProgram(
  partyId: string,
  parliamentId: string,
  year: number,
  title: string,
  sourceUrl: string,
  pdfHash: string,
) {
  const existing = await prisma.program.findFirst({
    where: {
      partyId,
      electionYear: year,
      programType: 'VERKIEZINGSPROGRAMMA',
    },
  });

  if (existing) return existing;

  // Create the program
  return prisma.program.create({
    data: {
      partyId,
      parliamentId,
      electionYear: year,
      programType: 'VERKIEZINGSPROGRAMMA',
      title,
      sourceUrl: sourceUrl || '',
      rawText: '', // Will be populated when we index for search
      pdfHash: pdfHash || null,
    },
  });
}

// ─── Seed Logic ────────────────────────────────────────────────────────────

export interface SeedMunicipalOptions {
  city?: string;
  party?: string;
  dryRun?: boolean;
  replace?: boolean;
}

export async function seedMunicipalPromises(options: SeedMunicipalOptions = {}): Promise<void> {
  console.log(`\n[SEED-MUNICIPAL] Seeding municipal promises (city=${options.city || 'all'}, party=${options.party || 'all'}, dryRun=${options.dryRun || false})...\n`);

  if (!existsSync(PROMISES_DIR)) {
    throw new Error(`Municipal promises directory not found: ${PROMISES_DIR}`);
  }

  // Read manifest
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Municipal manifest not found: ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  // Filter cities
  const cityKeys = options.city
    ? Object.keys(manifest.programs).filter((k) => k.includes(options.city!))
    : Object.keys(manifest.programs);

  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    for (const cityKey of cityKeys) {
      const cityData = manifest.programs[cityKey];
      const slug = cityData.parliamentSlug;
      const promisesDir = join(PROMISES_DIR, slug);

      console.log(`\n[SEED-MUNICIPAL] === ${cityData.election} ===`);

      // Find parliament
      const parliament = await prisma.parliament.findUnique({
        where: { slug },
      });

      if (!parliament) {
        console.log(`  ❌ Parliament not found for slug "${slug}". Run NotuBiz sync first.`);
        totalFailed++;
        continue;
      }

      if (!existsSync(promisesDir)) {
        console.log(`  ⏭ Promises directory not found: ${promisesDir}. Run extract-municipal first.`);
        totalSkipped++;
        continue;
      }

      // Find JSON files to process
      const jsonFiles = readdirSync(promisesDir)
        .filter(f => f.endsWith('.json'))
        .filter(f => !options.party || f.toLowerCase().startsWith(options.party.toLowerCase()));

      if (jsonFiles.length === 0) {
        console.log(`  ⏭ No promise JSON files found in ${promisesDir}`);
        totalSkipped++;
        continue;
      }

      for (const filename of jsonFiles) {
        const filePath = join(promisesDir, filename);
        const data: MunicipalPromiseFile = JSON.parse(readFileSync(filePath, 'utf-8'));
        const abbr = data.party;

        console.log(`  📂 ${abbr}: ${data.totalPromises} promises from ${filename}`);

        if (options.dryRun) {
          const themes: Record<string, number> = {};
          const specs: Record<string, number> = {};
          for (const p of data.promises) {
            themes[mapTheme(p.theme)] = (themes[mapTheme(p.theme)] || 0) + 1;
            specs[mapSpecificity(p.specificity)] = (specs[mapSpecificity(p.specificity)] || 0) + 1;
          }
          console.log(`    Themes: ${Object.entries(themes).map(([k, v]) => `${k}:${v}`).join(', ')}`);
          console.log(`    Specificity (mapped): ${Object.entries(specs).map(([k, v]) => `${k}:${v}`).join(', ')}`);
          totalSeeded += data.totalPromises;
          continue;
        }

        // Find party in this parliament
        const party = await findPartyInParliament(abbr, parliament.id);
        if (!party) {
          console.log(`  ❌ ${abbr}: Party not found in parliament "${slug}". Available parties:`);
          const available = await prisma.party.findMany({
            where: { parliamentId: parliament.id },
            select: { abbreviation: true },
          });
          console.log(`      ${available.map(p => p.abbreviation).join(', ')}`);
          totalFailed++;
          continue;
        }

        // Ensure program exists
        const program = await ensureProgram(
          party.id,
          parliament.id,
          data.electionYear,
          data.program,
          data.sourceUrl || '',
          data.pdfHash || '',
        );

        console.log(`    Program: ${program.id} (${program.title || 'untitled'})`);

        // Optionally delete existing promises
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
                extractedBy: data.extractionMethod || 'llm-claude-sonnet-v1',
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
                passageId: null,
                expectedVoteDirection: 'VOOR',
                extractedBy: data.extractionMethod || 'llm-claude-sonnet-v1',
              },
            });
            seeded++;
          } catch (err) {
            console.error(`    ❌ Failed to seed ${promise.promiseCode}: ${err}`);
          }
        }

        console.log(`  ✅ ${abbr}: ${seeded} promises seeded`);
        totalSeeded += seeded;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!options.dryRun) {
    console.log(`\n[SEED-MUNICIPAL] Done: ${totalSeeded} seeded, ${totalSkipped} skipped, ${totalFailed} failed`);
  } else {
    console.log(`\n[SEED-MUNICIPAL] Dry run complete: ${totalSeeded} promises would be seeded`);
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-municipal-promises.ts')) {
  const args = process.argv.slice(2);
  const cityArg = args.includes('--city') ? args[args.indexOf('--city') + 1] : undefined;
  const partyArg = args.includes('--party') ? args[args.indexOf('--party') + 1] : undefined;
  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');

  seedMunicipalPromises({ city: cityArg, party: partyArg, dryRun, replace }).catch(console.error);
}
