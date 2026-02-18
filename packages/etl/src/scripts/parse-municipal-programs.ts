/**
 * Parse municipal verkiezingsprogramma PDFs → structured JSON.
 *
 * Reuses parseProgramPdf() from parse-program-pdf.ts but reads from
 * the municipal directory structure and manifest.
 *
 * Usage:
 *   npx tsx src/scripts/parse-municipal-programs.ts --city amsterdam
 *   npx tsx src/scripts/parse-municipal-programs.ts --city den-haag --party PvdA
 *   npx tsx src/scripts/parse-municipal-programs.ts              # all cities
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseProgramPdf } from './parse-program-pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'programs', 'municipal');
const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');

interface MunicipalManifestParty {
  abbreviation: string;
  partySlug: string;
  title: string;
  pdfUrl?: string;
  localFilename: string;
  notes?: string;
}

interface MunicipalManifestCity {
  election: string;
  parliamentSlug: string;
  parties: MunicipalManifestParty[];
}

interface MunicipalManifest {
  description: string;
  lastUpdated: string;
  programs: Record<string, MunicipalManifestCity>;
}

export interface ParseMunicipalOptions {
  city?: string;
  party?: string;
}

export async function parseMunicipalPrograms(options: ParseMunicipalOptions = {}): Promise<void> {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Municipal manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest: MunicipalManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  // Filter by city if specified
  const cityKeys = options.city
    ? Object.keys(manifest.programs).filter((k) => k.includes(options.city!))
    : Object.keys(manifest.programs);

  if (cityKeys.length === 0) {
    console.log(`[PARSE-MUNICIPAL] No matching cities found for "${options.city}"`);
    return;
  }

  let totalParsed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const cityKey of cityKeys) {
    const cityData = manifest.programs[cityKey];
    const citySlug = cityData.parliamentSlug;
    const cityDir = join(DATA_DIR, citySlug);

    console.log(`\n[PARSE-MUNICIPAL] === ${cityData.election} ===`);

    if (!existsSync(cityDir)) {
      console.log(`  ⚠ City directory not found: ${cityDir}`);
      continue;
    }

    // Filter parties if specified
    const parties = options.party
      ? cityData.parties.filter((p) => p.abbreviation === options.party || p.partySlug === options.party?.toLowerCase())
      : cityData.parties;

    for (const entry of parties) {
      const pdfPath = join(cityDir, entry.localFilename);
      const outputPath = join(cityDir, `${entry.partySlug}_${citySlug}_2022-parsed.json`);

      // Skip if no file
      if (!entry.localFilename || entry.localFilename === '') {
        console.log(`  ⏭ ${entry.abbreviation}: No PDF file specified (${entry.notes || 'no notes'})`);
        totalSkipped++;
        continue;
      }

      if (!existsSync(pdfPath)) {
        console.log(`  ⏭ ${entry.abbreviation}: PDF not found at ${pdfPath}`);
        totalSkipped++;
        continue;
      }

      // Skip if already parsed
      if (existsSync(outputPath)) {
        try {
          const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
          console.log(`  ⏭ ${entry.abbreviation}: Already parsed (${existing.totalWords} words, ${existing.chapters?.length || 0} chapters)`);
          totalSkipped++;
          continue;
        } catch {
          // Invalid JSON, re-parse
        }
      }

      try {
        console.log(`  📄 Parsing ${entry.abbreviation} (${entry.localFilename})...`);
        const parsed = await parseProgramPdf(pdfPath, entry.abbreviation, 2022, entry.title);

        // Enrich with municipal metadata
        const output = {
          ...parsed,
          city: citySlug,
          parliamentSlug: citySlug,
          election: cityData.election,
        };

        writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`  ✅ ${entry.abbreviation}: ${parsed.totalWords} words, ${parsed.chapters.length} chapters, ${parsed.pageCount} pages → ${outputPath}`);
        totalParsed++;
      } catch (err) {
        console.error(`  ❌ ${entry.abbreviation}: Failed to parse — ${err}`);
        totalFailed++;
      }
    }
  }

  console.log(`\n[PARSE-MUNICIPAL] Done: ${totalParsed} parsed, ${totalSkipped} skipped, ${totalFailed} failed`);
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('parse-municipal-programs.ts')) {
  const args = process.argv.slice(2);
  const cityArg = args.includes('--city') ? args[args.indexOf('--city') + 1] : undefined;
  const partyArg = args.includes('--party') ? args[args.indexOf('--party') + 1] : undefined;

  parseMunicipalPrograms({ city: cityArg, party: partyArg }).catch(console.error);
}
