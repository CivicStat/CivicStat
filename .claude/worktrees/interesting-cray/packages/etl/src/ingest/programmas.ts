/**
 * Verkiezingsprogramma Ingest Pipeline
 * 
 * Downloads, parses, chunks and stores election programs.
 * 
 * Sources:
 *   Primary:   DNPP Repository (Rijksuniversiteit Groningen) – dnpprepo.ub.rug.nl
 *   Secondary: Party websites (for verification)
 * 
 * Audit trail:
 *   - SHA-256 hash of each downloaded PDF
 *   - File size in bytes
 *   - Download timestamp
 *   - Primary + secondary source URLs
 *   - RawIngest record per program
 * 
 * Usage:
 *   npx tsx src/ingest/programmas.ts                  # All programs
 *   npx tsx src/ingest/programmas.ts --year 2023      # Only TK2023
 *   npx tsx src/ingest/programmas.ts --party VVD      # Only VVD
 *   npx tsx src/ingest/programmas.ts --download-only  # Only download PDFs
 */

import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// We use dynamic imports for pdf-parse since it may not be installed yet
let pdfParse: any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Types ──────────────────────────────────────────────────────
interface ManifestEntry {
  abbreviation: string;
  title: string | null;
  dnppId: string | null;
  dnppUrl: string | null;
  pdfUrl: string | null;
  secondaryUrl: string | null;
  notes: string;
}

interface ManifestYear {
  election: string;
  notes?: string;
  parties: ManifestEntry[];
}

interface Manifest {
  programs: Record<string, ManifestYear>;
}

interface DownloadResult {
  filePath: string;
  hash: string;
  sizeBytes: number;
  downloadedAt: Date;
  pageCount: number;
  rawText: string;
}

interface Passage {
  chapter: string | null;
  heading: string | null;
  passageText: string;
  startOffset: number;
  endOffset: number;
}

// ─── Config ─────────────────────────────────────────────────────
const DATA_DIR = join(__dirname, '..', '..', 'data', 'programs');
const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');

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

// ─── Helpers ────────────────────────────────────────────────────
function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ─── Step 1: Download PDF ───────────────────────────────────────
async function downloadPdf(
  url: string,
  destPath: string
): Promise<{ buffer: Buffer; hash: string; sizeBytes: number }> {
  console.log(`  ⬇ Downloading: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CivicStat/1.0 (academic research; civicstat.nl)',
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText} for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = sha256(buffer);
  const sizeBytes = buffer.length;

  writeFileSync(destPath, buffer);
  console.log(`  ✓ Saved: ${destPath} (${(sizeBytes / 1024).toFixed(0)} KB, SHA-256: ${hash.slice(0, 16)}...)`);

  return { buffer, hash, sizeBytes };
}

// ─── Step 2: Parse PDF → Text ───────────────────────────────────
async function parsePdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  if (!pdfParse) {
    try {
      // Import pdf-parse/lib to avoid the test-file-loading bug in v1.x index.js
      const mod = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = typeof mod.default === 'function' ? mod.default : mod;
    } catch {
      throw new Error(
        'pdf-parse is not installed. Run: cd packages/etl && npm install pdf-parse'
      );
    }
  }

  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
  };
}

// ─── Step 3: Chunk Text → Passages ──────────────────────────────
/**
 * Splits program text into structured passages.
 * 
 * Strategy:
 * 1. Try to detect chapter boundaries via common Dutch patterns:
 *    - "Hoofdstuk 1: ...", "1. Titel", "TITEL IN CAPS"
 *    - Lines that are all-caps and short (< 80 chars)
 *    - Numbered sections like "1.1", "2.3"
 * 2. Within chapters, split into passages of ~500-1000 words
 * 3. Track character offsets for traceability
 */
function chunkText(rawText: string): Passage[] {
  const passages: Passage[] = [];
  const lines = rawText.split('\n');

  // Patterns for chapter/section detection
  const chapterPatterns = [
    /^Hoofdstuk\s+\d+/i,
    /^\d+\.\s+[A-Z]/,          // "1. Economie"
    /^[A-Z][A-Z\s]{10,}$/,     // ALL CAPS lines (min 10 chars)
    /^Deel\s+\d+/i,            // "Deel 1"
    /^H\d+\s/,                 // "H1 ..."
  ];

  const subHeadingPatterns = [
    /^\d+\.\d+\s/,             // "1.1 Sub"
    /^[A-Z][a-z]+(?:\s[a-z]+){0,4}\s*$/,  // Short capitalized line
  ];

  let currentChapter: string | null = null;
  let currentHeading: string | null = null;
  let currentText = '';
  let currentStart = 0;
  let charOffset = 0;

  function flushPassage() {
    const trimmed = currentText.trim();
    if (trimmed.length > 50) { // Skip very short fragments
      passages.push({
        chapter: currentChapter,
        heading: currentHeading,
        passageText: trimmed,
        startOffset: currentStart,
        endOffset: charOffset,
      });
    }
    currentText = '';
    currentStart = charOffset;
  }

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for chapter boundary
    const isChapter = chapterPatterns.some(p => p.test(trimmedLine));
    if (isChapter && trimmedLine.length < 120) {
      flushPassage();
      currentChapter = trimmedLine;
      currentHeading = null;
      currentStart = charOffset;
    }
    // Check for sub-heading
    else if (subHeadingPatterns.some(p => p.test(trimmedLine)) && trimmedLine.length < 80) {
      // If current passage is long enough, flush
      const wordCount = currentText.split(/\s+/).length;
      if (wordCount > 200) {
        flushPassage();
      }
      currentHeading = trimmedLine;
    }

    currentText += line + '\n';
    charOffset += line.length + 1;

    // Split on word count threshold
    const wordCount = currentText.split(/\s+/).length;
    if (wordCount > 800) {
      // Try to split at a paragraph break
      const lastDoubleNewline = currentText.lastIndexOf('\n\n');
      if (lastDoubleNewline > currentText.length * 0.3) {
        const keep = currentText.slice(lastDoubleNewline + 2);
        currentText = currentText.slice(0, lastDoubleNewline);
        flushPassage();
        currentText = keep;
        currentStart = charOffset - keep.length;
      } else {
        flushPassage();
      }
    }
  }

  // Flush remaining
  flushPassage();

  return passages;
}

// ─── Step 4: Store in Database ──────────────────────────────────
async function storeProgram(
  prisma: any,
  entry: ManifestEntry,
  year: number,
  download: DownloadResult
): Promise<void> {
  // Find the party by abbreviation (with alias support)
  const aliases = PARTY_ALIASES[entry.abbreviation] || [];
  const searchTerms = [entry.abbreviation, ...aliases];

  const party = await prisma.party.findFirst({
    where: {
      OR: [
        ...searchTerms.map(term => ({ abbreviation: term })),
        ...searchTerms.map(term => ({ name: term })),
        ...searchTerms.map(term => ({ name: { contains: term } })),
      ],
    },
  });

  if (!party) {
    console.log(`  ⚠ Party not found in DB: ${entry.abbreviation} – skipping`);
    return;
  }

  // Chunk the text into passages
  const passages = chunkText(download.rawText);
  console.log(`  📄 ${passages.length} passages extracted`);

  // Upsert Program record
  const program = await prisma.program.upsert({
    where: {
      partyId_electionYear: {
        partyId: party.id,
        electionYear: year,
      },
    },
    create: {
      partyId: party.id,
      electionYear: year,
      title: entry.title || '',
      sourceUrl: entry.dnppUrl || entry.pdfUrl || '',
      secondarySourceUrl: entry.secondaryUrl,
      pdfHash: download.hash,
      pdfSizeBytes: download.sizeBytes,
      downloadedAt: download.downloadedAt,
      rawText: download.rawText,
      pageCount: download.pageCount,
    },
    update: {
      title: entry.title || '',
      sourceUrl: entry.dnppUrl || entry.pdfUrl || '',
      secondarySourceUrl: entry.secondaryUrl,
      pdfHash: download.hash,
      pdfSizeBytes: download.sizeBytes,
      downloadedAt: download.downloadedAt,
      rawText: download.rawText,
      pageCount: download.pageCount,
    },
  });

  // Delete existing passages (re-ingest)
  await prisma.programPassage.deleteMany({
    where: { programId: program.id },
  });

  // Insert new passages
  for (const passage of passages) {
    await prisma.programPassage.create({
      data: {
        programId: program.id,
        chapter: passage.chapter,
        heading: passage.heading,
        passageText: passage.passageText,
        startOffset: passage.startOffset,
        endOffset: passage.endOffset,
      },
    });
  }

  // Audit trail: RawIngest record
  await prisma.rawIngest.create({
    data: {
      source: 'DNPP_PROGRAM',
      resourceType: 'Program',
      resourceId: `${entry.abbreviation}_${year}`,
      sourceUrl: entry.dnppUrl || entry.pdfUrl || '',
      payload: {
        abbreviation: entry.abbreviation,
        title: entry.title,
        electionYear: year,
        dnppId: entry.dnppId,
        dnppUrl: entry.dnppUrl,
        pdfUrl: entry.pdfUrl,
        secondaryUrl: entry.secondaryUrl,
        pdfHash: download.hash,
        pdfSizeBytes: download.sizeBytes,
        pageCount: download.pageCount,
        passageCount: passages.length,
        totalWordCount: download.rawText.split(/\s+/).length,
      },
    },
  });

  console.log(`  ✅ Stored: ${entry.abbreviation} ${year} (${passages.length} passages, ${download.pageCount} pages)`);
}

// ─── Main Pipeline ──────────────────────────────────────────────
export async function ingestProgrammas(options?: {
  year?: number;
  party?: string;
  downloadOnly?: boolean;
}) {
  console.log('\n📚 VERKIEZINGSPROGRAMMA INGEST');
  console.log('================================');
  console.log('Bron: DNPP Repository (Rijksuniversiteit Groningen)');
  console.log('Verificatie: Partijwebsites\n');

  // Load manifest
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }
  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  // Filter years
  const years = options?.year
    ? [String(options.year)]
    : Object.keys(manifest.programs);

  // Initialize Prisma (only if not download-only)
  let prisma: any = null;
  if (!options?.downloadOnly) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  }

  let totalDownloaded = 0;
  let totalStored = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    for (const year of years) {
      const yearData = manifest.programs[year];
      if (!yearData) {
        console.log(`⚠ Year ${year} not found in manifest`);
        continue;
      }

      console.log(`\n📅 ${yearData.election}`);
      console.log('─'.repeat(50));

      const entries = options?.party
        ? yearData.parties.filter(p => p.abbreviation === options.party)
        : yearData.parties;

      for (const entry of entries) {
        console.log(`\n🏛 ${entry.abbreviation}: ${entry.title || '(titel onbekend)'}`);

        // Check if we have a PDF URL
        if (!entry.pdfUrl) {
          console.log(`  ⏭ Geen PDF URL beschikbaar – overslaan`);
          totalSkipped++;
          continue;
        }

        try {
          const filename = `${entry.abbreviation.toLowerCase()}_${year}.pdf`;
          const filePath = join(DATA_DIR, filename);

          let buffer: Buffer;
          let hash: string;
          let sizeBytes: number;

          // Download or use cached
          if (existsSync(filePath)) {
            console.log(`  📁 Cached: ${filePath}`);
            buffer = readFileSync(filePath);
            hash = sha256(buffer);
            sizeBytes = buffer.length;
          } else {
            const result = await downloadPdf(entry.pdfUrl, filePath);
            buffer = result.buffer;
            hash = result.hash;
            sizeBytes = result.sizeBytes;

            // Be polite to DNPP servers
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          totalDownloaded++;

          if (options?.downloadOnly) {
            continue;
          }

          // Parse PDF
          console.log(`  📖 Parsing PDF...`);
          const { text, pageCount } = await parsePdf(buffer);
          console.log(`  ✓ ${pageCount} pages, ${text.split(/\s+/).length} words`);

          // Store in DB
          await storeProgram(prisma, entry, parseInt(year), {
            filePath,
            hash,
            sizeBytes,
            downloadedAt: new Date(),
            pageCount,
            rawText: text,
          });

          totalStored++;
        } catch (error) {
          console.error(`  ❌ Failed: ${entry.abbreviation} – ${error}`);
          totalFailed++;
        }
      }
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }

  console.log('\n════════════════════════════════');
  console.log(`📊 Resultaat:`);
  console.log(`   Downloaded: ${totalDownloaded}`);
  console.log(`   Stored:     ${totalStored}`);
  console.log(`   Skipped:    ${totalSkipped} (geen PDF URL)`);
  console.log(`   Failed:     ${totalFailed}`);
  console.log('════════════════════════════════\n');
}

// ─── CLI Entry Point ────────────────────────────────────────────
const isMain = process.argv[1]?.includes('programmas');
if (isMain) {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const downloadOnly = args.includes('--download-only');

  ingestProgrammas({
    year: yearArg ? parseInt(yearArg) : undefined,
    party: partyArg,
    downloadOnly,
  }).catch(err => {
    console.error('❌ Programma ingest failed:', err);
    process.exit(1);
  });
}
