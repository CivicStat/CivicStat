/**
 * Parse verkiezingsprogramma PDFs to structured text.
 *
 * Reads PDFs from data/programs/ and outputs parsed JSON files
 * with raw text, page-level text, SHA-256 hash, and chapter structure.
 *
 * Usage:
 *   npx tsx src/scripts/parse-program-pdf.ts                    # All TK2023 PDFs
 *   npx tsx src/scripts/parse-program-pdf.ts --party VVD        # Only VVD
 *   npx tsx src/scripts/parse-program-pdf.ts --year 2025        # Only TK2025
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = join(__dirname, '..', '..', 'data', 'programs');
const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');

// ─── Types ──────────────────────────────────────────────────────

interface ManifestEntry {
  abbreviation: string;
  title: string | null;
  dnppId: string | null;
  pdfUrl: string | null;
  notes: string;
}

interface ManifestYear {
  election: string;
  parties: ManifestEntry[];
}

interface Manifest {
  programs: Record<string, ManifestYear>;
}

interface ParsedPage {
  pageNumber: number;
  text: string;
}

interface ParsedChapter {
  title: string;
  startPage: number;
  endPage: number;
  text: string;
}

export interface ParsedProgram {
  party: string;
  partySlug: string;
  filename: string;
  pdfHash: string;
  pdfSizeBytes: number;
  pageCount: number;
  totalWords: number;
  fullText: string;
  pages: ParsedPage[];
  chapters: ParsedChapter[];
  parsedAt: string;
}

// ─── PDF Parsing ────────────────────────────────────────────────

let pdfParse: any;

async function loadPdfParse() {
  if (!pdfParse) {
    try {
      const mod = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = typeof mod.default === 'function' ? mod.default : mod;
    } catch {
      throw new Error('pdf-parse is not installed. Run: cd packages/etl && pnpm install pdf-parse');
    }
  }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Chapter detection from raw text.
 * Detects patterns like:
 *   "Hoofdstuk 1: ...", "1. Economie", "ALL CAPS HEADING", "Deel 1"
 */
function detectChapters(rawText: string, pageCount: number): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  const lines = rawText.split('\n');

  const chapterPatterns = [
    /^Hoofdstuk\s+\d+/i,
    /^\d+\.\s+[A-Z][a-zA-Z\s]+$/,
    /^[A-Z][A-Z\s]{8,}$/,
    /^Deel\s+\d+/i,
  ];

  let currentTitle = 'Inleiding';
  let currentText = '';
  let currentStartPage = 1;
  let lineCount = 0;

  const linesPerPage = Math.max(1, lines.length / Math.max(1, pageCount));

  for (const line of lines) {
    lineCount++;
    const trimmed = line.trim();

    const isChapter = chapterPatterns.some(p => p.test(trimmed));
    if (isChapter && trimmed.length > 3 && trimmed.length < 120) {
      if (currentText.trim().length > 100) {
        const endPage = Math.ceil(lineCount / linesPerPage);
        chapters.push({
          title: currentTitle,
          startPage: currentStartPage,
          endPage: Math.max(currentStartPage, endPage - 1),
          text: currentText.trim(),
        });
      }
      currentTitle = trimmed;
      currentText = '';
      currentStartPage = Math.ceil(lineCount / linesPerPage);
    }

    currentText += line + '\n';
  }

  // Flush final chapter
  if (currentText.trim().length > 100) {
    chapters.push({
      title: currentTitle,
      startPage: currentStartPage,
      endPage: pageCount,
      text: currentText.trim(),
    });
  }

  return chapters;
}

// ─── Per-page text extraction ───────────────────────────────────

async function extractPages(buffer: Buffer): Promise<ParsedPage[]> {
  await loadPdfParse();

  const pages: ParsedPage[] = [];

  // pdf-parse supports a pagerender callback for per-page text
  const options = {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        return textContent.items.map((item: any) => item.str).join(' ');
      });
    },
  };

  const data = await pdfParse(buffer, options);

  // pdf-parse doesn't natively provide per-page text easily
  // Use a simple heuristic: split fullText by form-feed or approximate
  // For reliable per-page text, we use the raw text split
  const fullText: string = data.text;
  const numPages: number = data.numpages;

  // Approximate per-page text by splitting evenly (pdf-parse doesn't expose per-page)
  const avgCharsPerPage = Math.ceil(fullText.length / numPages);
  for (let i = 0; i < numPages; i++) {
    const start = i * avgCharsPerPage;
    const end = Math.min((i + 1) * avgCharsPerPage, fullText.length);
    pages.push({
      pageNumber: i + 1,
      text: fullText.slice(start, end),
    });
  }

  return pages;
}

// ─── Main Parse Logic ───────────────────────────────────────────

export async function parseProgramPdf(
  pdfPath: string,
  abbreviation: string,
  _year: number,
  _title: string | null,
): Promise<ParsedProgram> {
  await loadPdfParse();

  const buffer = readFileSync(pdfPath);
  const hash = sha256(buffer);
  const sizeBytes = statSync(pdfPath).size;
  const data = await pdfParse(buffer);

  const fullText: string = data.text;
  const pageCount: number = data.numpages;
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;

  const chapters = detectChapters(fullText, pageCount);
  const pages = await extractPages(buffer);

  const slug = abbreviation.toLowerCase();

  return {
    party: abbreviation,
    partySlug: slug,
    filename: basename(pdfPath),
    pdfHash: hash,
    pdfSizeBytes: sizeBytes,
    pageCount,
    totalWords,
    fullText,
    pages,
    chapters,
    parsedAt: new Date().toISOString(),
  };
}

// ─── Batch Parse All ────────────────────────────────────────────

interface ParseOptions {
  year?: number;
  party?: string;
}

export async function parseAllPrograms(options: ParseOptions = {}): Promise<void> {
  const year = options.year ?? 2023;
  console.log(`\n[PARSE] Parsing verkiezingsprogramma PDFs (year=${year}, party=${options.party || 'all'})...\n`);

  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const yearData = manifest.programs[String(year)];

  if (!yearData) {
    throw new Error(`Year ${year} not found in manifest`);
  }

  const entries = options.party
    ? yearData.parties.filter(p => p.abbreviation === options.party)
    : yearData.parties;

  let parsed = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    const filename = `${entry.abbreviation.toLowerCase()}_${year}.pdf`;
    const pdfPath = join(DATA_DIR, filename);

    if (!existsSync(pdfPath)) {
      console.log(`  ⏭ ${entry.abbreviation}: PDF not found (${filename}) — run 'programs download' first`);
      skipped++;
      continue;
    }

    try {
      console.log(`  📖 Parsing ${entry.abbreviation}...`);
      const result = await parseProgramPdf(pdfPath, entry.abbreviation, year, entry.title ?? null);

      // Write parsed output (exclude fullText from file to save space, store pages instead)
      const outputPath = join(DATA_DIR, `${entry.abbreviation.toLowerCase()}_${year}-parsed.json`);
      writeFileSync(outputPath, JSON.stringify(result, null, 2));

      console.log(`  ✅ ${entry.abbreviation}: ${result.pageCount} pages, ${result.totalWords} words, ${result.chapters.length} chapters, hash ${result.pdfHash.slice(0, 16)}... → ${outputPath}`);
      parsed++;
    } catch (err) {
      console.error(`  ❌ ${entry.abbreviation}: ${err}`);
      failed++;
    }
  }

  console.log(`\n[PARSE] Done: ${parsed} parsed, ${skipped} skipped, ${failed} failed`);
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('parse-program-pdf.ts')) {
  const args = process.argv.slice(2);
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;

  parseAllPrograms({
    party: partyArg,
    year: yearArg ? parseInt(yearArg) : undefined,
  }).catch(console.error);
}
