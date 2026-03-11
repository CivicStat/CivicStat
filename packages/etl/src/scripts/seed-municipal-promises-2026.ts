/**
 * Seed municipal promises from extracted JSON files into the database.
 *
 * Reads JSON files from data/promises/municipal/{city}-2026/
 * and creates Program + Promise records.
 *
 * Usage:
 *   npx tsx src/scripts/seed-municipal-promises-2026.ts --city amsterdam
 *   npx tsx src/scripts/seed-municipal-promises-2026.ts --city den-haag
 *   npx tsx src/scripts/seed-municipal-promises-2026.ts --city all
 *   npx tsx src/scripts/seed-municipal-promises-2026.ts --city amsterdam --party vvd
 *   npx tsx src/scripts/seed-municipal-promises-2026.ts --city all --replace
 *   npx tsx src/scripts/seed-municipal-promises-2026.ts --city all --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises', 'municipal');

const prisma = new PrismaClient();

// ─── Theme Mapping (extraction slug → Prisma PromiseTheme enum) ──

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

function mapTheme(input: string): string {
  const slug = input.toLowerCase().trim();
  const mapped = THEME_MAP[slug];
  if (!mapped) {
    console.warn(`    ⚠ Unknown theme "${input}", defaulting to BESTUUR`);
    return 'BESTUUR';
  }
  return mapped;
}

// ─── Specificity Mapping (HIGH/MEDIUM → Prisma enum) ─────────

function mapSpecificity(input: string): string {
  const upper = (input || 'MEDIUM').toUpperCase();
  if (upper === 'HIGH') return 'CONCRETE';
  if (upper === 'MEDIUM') return 'DIRECTIONAL';
  if (upper === 'LOW') return 'VAGUE';
  // Passthrough for already-mapped values
  if (['CONCRETE', 'DIRECTIONAL', 'VAGUE'].includes(upper)) return upper;
  return 'DIRECTIONAL';
}

// ─── City → Parliament Mapping ───────────────────────────────

const PARLIAMENT_SLUGS: Record<string, string> = {
  'amsterdam': 'amsterdam',
  'den-haag': 'den-haag',
  'rotterdam': 'rotterdam',
  'utrecht': 'utrecht',
};

// ─── Party Matching ──────────────────────────────────────────
// Maps party slug from extraction → DB lookup strategy.
// Some parties have different names in the 2022 municipal DB vs 2026 programs.

const PARTY_ALIASES: Record<string, string[]> = {
  'groenlinks': ['GroenLinks', 'GL'],
  'pvda': ['PvdA', 'Partij van de Arbeid'],
  'pvdd': ['Partij voor de Dieren', 'PvdD'],
  'sp': ['SP', 'Socialistische Partij'],
  'cda': ['CDA', 'Christen-Democratisch Appèl'],
  'denk': ['DENK'],
  'd66': ['D66', 'Democraten 66'],
  'volt': ['Volt', 'VOLT', 'Volt Nederland'],
  'vvd': ['VVD', 'Volkspartij voor Vrijheid en Democratie'],
  'hart-voor-den-haag': ['Hart voor Den Haag'],
  'groenlinks-pvda': ['GroenLinks-PvdA', 'GroenLinks', 'PvdA'],
  // Rotterdam
  'leefbaar-rotterdam': ['Leefbaar Rotterdam'],
  'christenunie': ['ChristenUnie', 'CU'],
  '50plus': ['50PLUS', '50Plus'],
  'fvd': ['Forum voor Democratie', 'FvD'],
  'bij1': ['BIJ1', 'Bij1'],
  'nsc': ['NSC', 'Nieuw Sociaal Contract'],
  // Utrecht
  'link': ['LINK'],
  'ss': ['S&S', 'Stadsbelang Utrecht'],
  'eenutrecht': ['EenUtrecht'],
  'student-starter': ['Student&Starter'],
  'utrechtnu': ['UtrechtNu!'],
  'horizon': ['Horizon'],
};

async function findParty(partySlug: string, parliamentId: string) {
  const aliases = PARTY_ALIASES[partySlug] || [partySlug];

  const party = await prisma.party.findFirst({
    where: {
      parliamentId,
      OR: [
        ...aliases.map(name => ({ abbreviation: name })),
        ...aliases.map(name => ({ name })),
      ],
    },
  });

  return party;
}

// ─── Types ───────────────────────────────────────────────────

interface PromiseEntry {
  text: string;
  originalText: string;
  theme: string;
  specificity: string;
  verifiable: boolean;
  keywords: string[];
}

interface PromiseFile {
  party: string;
  partySlug: string;
  city: string;
  parliamentSlug: string;
  program: string;
  electionYear: number;
  sourceFile: string;
  extractedAt: string;
  extractedBy: string;
  promises: PromiseEntry[];
}

// ─── Seed Logic ──────────────────────────────────────────────

interface SeedOptions {
  city: string;
  party?: string;
  dryRun?: boolean;
  replace?: boolean;
}

export async function seedMunicipalPromises(options: SeedOptions): Promise<void> {
  const cities = options.city === 'all' ? ['amsterdam', 'den-haag', 'rotterdam', 'utrecht'] : [options.city];

  console.log(`\n[SEED-MUNICIPAL] Seeding municipal promises 2026`);
  console.log(`  Cities: ${cities.join(', ')}`);
  console.log(`  Party filter: ${options.party || 'all'}`);
  console.log(`  Dry run: ${options.dryRun || false}`);
  console.log(`  Replace: ${options.replace || false}\n`);

  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    for (const city of cities) {
      const cityDir = join(PROMISES_DIR, `${city}-2026`);
      if (!existsSync(cityDir)) {
        console.log(`  ⏭ No promises directory for ${city}: ${cityDir}`);
        continue;
      }

      // Find parliament
      const parliamentSlug = PARLIAMENT_SLUGS[city];
      if (!parliamentSlug) {
        console.error(`  ❌ Unknown city: ${city}`);
        continue;
      }

      const parliament = await prisma.parliament.findFirst({
        where: { slug: parliamentSlug },
      });
      if (!parliament) {
        console.error(`  ❌ Parliament not found for slug: ${parliamentSlug}`);
        continue;
      }

      console.log(`  📍 ${city.toUpperCase()} (${parliament.name})\n`);

      // Find JSON files
      let files = readdirSync(cityDir).filter(f => f.endsWith('.json'));
      if (options.party) {
        files = files.filter(f => f.startsWith(options.party!));
      }

      for (const filename of files) {
        const filePath = join(cityDir, filename);
        const data: PromiseFile = JSON.parse(readFileSync(filePath, 'utf-8'));

        console.log(`    📂 ${data.party} (${data.promises.length} promises from ${filename})`);

        if (options.dryRun) {
          // Show theme distribution
          const themes: Record<string, number> = {};
          for (const p of data.promises) {
            const mapped = mapTheme(p.theme);
            themes[mapped] = (themes[mapped] || 0) + 1;
          }
          console.log(`      Themes: ${Object.entries(themes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ')}`);
          const specs: Record<string, number> = {};
          for (const p of data.promises) {
            const mapped = mapSpecificity(p.specificity);
            specs[mapped] = (specs[mapped] || 0) + 1;
          }
          console.log(`      Specificity: ${Object.entries(specs).map(([k, v]) => `${k}:${v}`).join(', ')}`);
          continue;
        }

        // Find party in DB
        const party = await findParty(data.partySlug, parliament.id);
        if (!party) {
          console.warn(`      ⚠ Party "${data.party}" (slug: ${data.partySlug}) not found in ${city} DB. Skipping.`);
          totalFailed++;
          continue;
        }

        // Find or create Program
        let program = await prisma.program.findFirst({
          where: {
            partyId: party.id,
            electionYear: 2026,
            programType: 'VERKIEZINGSPROGRAMMA',
          },
        });

        if (!program) {
          program = await prisma.program.create({
            data: {
              partyId: party.id,
              electionYear: 2026,
              programType: 'VERKIEZINGSPROGRAMMA',
              title: data.program,
              sourceUrl: '',
              rawText: '', // We don't store full text for municipal programs
              parliamentId: parliament.id,
            },
          });
          console.log(`      📝 Created Program record for ${data.party} ${city} 2026`);
        }

        // Optionally delete existing promises
        if (options.replace) {
          const deleted = await prisma.promise.deleteMany({
            where: { programId: program.id },
          });
          if (deleted.count > 0) {
            console.log(`      🗑 Deleted ${deleted.count} existing promises`);
          }
        }

        // Seed promises
        let seeded = 0;
        for (let i = 0; i < data.promises.length; i++) {
          const p = data.promises[i];
          const promiseCode = `${data.partySlug.toUpperCase()}-${city.toUpperCase()}-2026-${String(i + 1).padStart(3, '0')}`;

          try {
            await prisma.promise.upsert({
              where: {
                programId_promiseCode: {
                  programId: program.id,
                  promiseCode,
                },
              },
              update: {
                text: p.originalText || p.text,
                summary: p.text,
                theme: mapTheme(p.theme) as any,
                specificity: mapSpecificity(p.specificity) as any,
                keywords: p.keywords,
                sourceRef: `Verkiezingsprogramma ${data.party} ${city} 2026`,
                extractedBy: data.extractedBy || 'llm:claude-opus-4',
                expectedVoteDirection: 'VOOR',
              },
              create: {
                programId: program.id,
                promiseCode,
                text: p.originalText || p.text,
                summary: p.text,
                theme: mapTheme(p.theme) as any,
                specificity: mapSpecificity(p.specificity) as any,
                keywords: p.keywords,
                sourceRef: `Verkiezingsprogramma ${data.party} ${city} 2026`,
                extractedBy: data.extractedBy || 'llm:claude-opus-4',
                expectedVoteDirection: 'VOOR',
                passageId: null,
              },
            });
            seeded++;
          } catch (err: any) {
            console.error(`      ❌ Failed ${promiseCode}: ${err.message}`);
          }
        }

        console.log(`    ✅ ${data.party}: ${seeded} promises seeded`);
        totalSeeded += seeded;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!options.dryRun) {
    console.log(`\n[SEED-MUNICIPAL] Done: ${totalSeeded} seeded, ${totalSkipped} skipped, ${totalFailed} failed\n`);
  }
}

// ─── CLI ─────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-municipal-promises-2026.ts')) {
  const args = process.argv.slice(2);

  const cityIdx = args.indexOf('--city');
  const city = cityIdx >= 0 ? args[cityIdx + 1] : undefined;

  const partyIdx = args.indexOf('--party');
  const party = partyIdx >= 0 ? args[partyIdx + 1] : undefined;

  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');

  if (!city) {
    console.error('Usage: npx tsx src/scripts/seed-municipal-promises-2026.ts --city <amsterdam|den-haag|all> [--party <slug>] [--dry-run] [--replace]');
    process.exit(1);
  }

  seedMunicipalPromises({ city, party, dryRun, replace }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
