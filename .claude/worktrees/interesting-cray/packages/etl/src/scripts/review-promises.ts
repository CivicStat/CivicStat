/**
 * Quality Review for Extracted Promises.
 *
 * Generates a quality report on extracted promise JSON files.
 * Checks:
 * 1. Total count (target: 750-1500)
 * 2. Per-party count (target: 40-100)
 * 3. All 12 PromiseTheme values represented per party
 * 4. Specificity distribution (not >70% VAAG)
 * 5. No duplicate promiseCodes
 * 6. All promises have ≥3 keywords
 * 7. No promise text <20 chars or >500 chars
 *
 * Usage:
 *   npx tsx src/scripts/review-promises.ts                     # Review all
 *   npx tsx src/scripts/review-promises.ts --party VVD         # Review VVD only
 *   npx tsx src/scripts/review-promises.ts --verbose           # Show individual issues
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMISES_DIR = join(__dirname, '..', '..', 'data', 'promises');

// ─── Types ──────────────────────────────────────────────────────

interface PromiseEntry {
  promiseCode: string;
  text: string;
  summary: string;
  theme: string;
  specificity: string;
  keywords: string[];
  sourceRef: string;
  originalQuote?: string;
}

interface PromiseFile {
  party: string;
  partySlug: string;
  electionYear: number;
  totalPromises: number;
  extractionMethod: string;
  promises: PromiseEntry[];
}

interface QualityIssue {
  promiseCode: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

interface PartyReport {
  party: string;
  promiseCount: number;
  themeDistribution: Record<string, number>;
  specificityDistribution: Record<string, number>;
  avgKeywords: number;
  avgTextLength: number;
  issues: QualityIssue[];
  score: number; // 0-100 quality score
}

// ─── Valid Values ───────────────────────────────────────────────

const ALL_THEMES = [
  'DEFENSIE', 'WONEN', 'MIGRATIE', 'KLIMAAT', 'ZORG',
  'ONDERWIJS', 'ECONOMIE', 'VEILIGHEID', 'BESTUUR', 'SOCIAAL',
  'LANDBOUW', 'BUITENLAND',
];

const VALID_SPECIFICITIES = ['SPECIFIEK', 'GEMIDDELD', 'VAAG', 'CONCRETE', 'DIRECTIONAL', 'VAGUE'];

// ─── Review Logic ───────────────────────────────────────────────

function reviewParty(data: PromiseFile): PartyReport {
  const issues: QualityIssue[] = [];
  const themes: Record<string, number> = {};
  const specs: Record<string, number> = {};
  let totalKeywords = 0;
  let totalTextLen = 0;
  const promiseCodes = new Set<string>();
  const summaries: string[] = [];

  // 1. Per-party promise count (target: 40-100)
  if (data.totalPromises < 40) {
    issues.push({
      promiseCode: '-',
      severity: 'WARNING',
      message: `Low promise count: ${data.totalPromises} (target: 40-100)`,
    });
  } else if (data.totalPromises > 100) {
    issues.push({
      promiseCode: '-',
      severity: 'WARNING',
      message: `High promise count: ${data.totalPromises} (target: 40-100; may indicate low quality filtering)`,
    });
  }

  for (const p of data.promises) {
    // Theme distribution
    themes[p.theme] = (themes[p.theme] || 0) + 1;

    // Specificity distribution
    specs[p.specificity] = (specs[p.specificity] || 0) + 1;

    // Keyword quality — must have ≥3 keywords
    totalKeywords += p.keywords?.length || 0;
    if (!p.keywords || p.keywords.length < 3) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'WARNING',
        message: `Fewer than 3 keywords (has ${p.keywords?.length || 0}, need ≥3)`,
      });
    }

    // Text length check: 20-500 chars
    totalTextLen += p.text.length;
    if (p.text.length < 20) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'ERROR',
        message: `Text too short: ${p.text.length} chars (minimum: 20)`,
      });
    } else if (p.text.length > 500) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'WARNING',
        message: `Text too long: ${p.text.length} chars (maximum: 500)`,
      });
    }

    // Summary check
    if (p.summary.length < 10) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'WARNING',
        message: `Summary too short: "${p.summary}" (${p.summary.length} chars)`,
      });
    }

    // Theme validation
    if (!ALL_THEMES.includes(p.theme.toUpperCase())) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'ERROR',
        message: `Invalid theme: "${p.theme}"`,
      });
    }

    // Specificity validation
    if (!VALID_SPECIFICITIES.includes(p.specificity.toUpperCase())) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'ERROR',
        message: `Invalid specificity: "${p.specificity}"`,
      });
    }

    // Duplicate promiseCode check
    if (promiseCodes.has(p.promiseCode)) {
      issues.push({
        promiseCode: p.promiseCode,
        severity: 'ERROR',
        message: `Duplicate promiseCode: "${p.promiseCode}"`,
      });
    }
    promiseCodes.add(p.promiseCode);

    summaries.push(p.summary.toLowerCase());
  }

  // Check for duplicate summaries (Jaccard similarity on words)
  for (let i = 0; i < summaries.length; i++) {
    for (let j = i + 1; j < summaries.length; j++) {
      const wordsA = new Set(summaries[i].split(/\s+/));
      const wordsB = new Set(summaries[j].split(/\s+/));
      let intersection = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
      }
      const unionSize = wordsA.size + wordsB.size - intersection;
      const similarity = unionSize > 0 ? intersection / unionSize : 0;

      if (similarity > 0.7) {
        issues.push({
          promiseCode: data.promises[i].promiseCode,
          severity: 'WARNING',
          message: `Possible duplicate with ${data.promises[j].promiseCode} (similarity: ${(similarity * 100).toFixed(0)}%)`,
        });
      }
    }
  }

  // All 12 themes should be represented
  const coveredThemes = Object.keys(themes).length;
  const missingThemes = ALL_THEMES.filter(t => !themes[t.toUpperCase()]);
  if (missingThemes.length > 0) {
    issues.push({
      promiseCode: '-',
      severity: missingThemes.length > 6 ? 'WARNING' : 'INFO',
      message: `Missing ${missingThemes.length} themes: ${missingThemes.join(', ')} (${coveredThemes}/${ALL_THEMES.length} covered)`,
    });
  }

  // Specificity distribution: not >70% VAAG
  const vaagCount = (specs['VAAG'] || 0) + (specs['VAGUE'] || 0);
  const vaagRatio = data.totalPromises > 0 ? vaagCount / data.totalPromises : 0;
  if (vaagRatio > 0.70) {
    issues.push({
      promiseCode: '-',
      severity: 'WARNING',
      message: `Too many VAAG/VAGUE: ${(vaagRatio * 100).toFixed(0)}% (max 70%)`,
    });
  }

  // Compute quality score (0-100)
  let score = 100;
  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;
  score -= errorCount * 10;
  score -= warningCount * 3;

  // Bonus for good count range
  if (data.totalPromises >= 40 && data.totalPromises <= 100) score += 5;
  // Bonus for good theme coverage
  if (coveredThemes >= 10) score += 5;

  score = Math.max(0, Math.min(100, score));

  return {
    party: data.party,
    promiseCount: data.totalPromises,
    themeDistribution: themes,
    specificityDistribution: specs,
    avgKeywords: data.totalPromises > 0 ? Math.round((totalKeywords / data.totalPromises) * 10) / 10 : 0,
    avgTextLength: data.totalPromises > 0 ? Math.round(totalTextLen / data.totalPromises) : 0,
    issues,
    score,
  };
}

// ─── Main Review ────────────────────────────────────────────────

interface ReviewOptions {
  party?: string;
  year?: number;
  verbose?: boolean;
}

export async function reviewPromises(options: ReviewOptions = {}): Promise<void> {
  const year = options.year ?? 2023;
  console.log(`\n[REVIEW] Quality review of extracted promises (year=${year})...\n`);

  if (!existsSync(PROMISES_DIR)) {
    console.log('[REVIEW] Promises directory not found. Run extract-promises first.');
    return;
  }

  const files = options.party
    ? [`${options.party.toLowerCase()}-tk${year}.json`]
    : readdirSync(PROMISES_DIR).filter(f => f.endsWith(`-tk${year}.json`));

  if (files.length === 0) {
    console.log('[REVIEW] No promise JSON files found.');
    return;
  }

  const reports: PartyReport[] = [];

  for (const filename of files) {
    const filePath = join(PROMISES_DIR, filename);
    if (!existsSync(filePath)) {
      console.log(`  ⏭ ${filename}: Not found`);
      continue;
    }

    const data: PromiseFile = JSON.parse(readFileSync(filePath, 'utf-8'));
    const report = reviewParty(data);
    reports.push(report);

    // Print report
    const scoreEmoji = report.score >= 80 ? '🟢' : report.score >= 60 ? '🟡' : '🔴';
    console.log(`${scoreEmoji} ${report.party}: ${report.promiseCount} promises, score ${report.score}/100`);
    console.log(`    Themes: ${Object.entries(report.themeDistribution).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    console.log(`    Specificity: ${Object.entries(report.specificityDistribution).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    console.log(`    Avg keywords: ${report.avgKeywords}, Avg text length: ${report.avgTextLength} chars`);

    const errors = report.issues.filter(i => i.severity === 'ERROR');
    const warnings = report.issues.filter(i => i.severity === 'WARNING');
    const infos = report.issues.filter(i => i.severity === 'INFO');
    console.log(`    Issues: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`);

    if (options.verbose) {
      for (const issue of report.issues) {
        const icon = issue.severity === 'ERROR' ? '❌' : issue.severity === 'WARNING' ? '⚠️' : 'ℹ️';
        console.log(`      ${icon} [${issue.promiseCode}] ${issue.message}`);
      }
    }
    console.log('');
  }

  // Summary
  if (reports.length > 0) {
    const totalPromises = reports.reduce((sum, r) => sum + r.promiseCount, 0);
    const avgScore = Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length);
    console.log('═══════════════════════════════════════');
    console.log(`TOTAAL: ${totalPromises} beloften over ${reports.length} partijen`);
    console.log(`Gemiddelde kwaliteitsscore: ${avgScore}/100`);

    // Check global target (750-1500)
    if (totalPromises < 750) {
      console.log(`\n⚠️ Onder globale target: ${totalPromises} (doel: 750-1500)`);
    } else if (totalPromises > 1500) {
      console.log(`\n⚠️ Boven globale target: ${totalPromises} (doel: 750-1500)`);
    } else {
      console.log(`\n✅ Globale target bereikt: ${totalPromises} (doel: 750-1500)`);
    }

    // Parties below threshold
    const poor = reports.filter(r => r.score < 60);
    if (poor.length > 0) {
      console.log(`\n⚠️ Partijen met lage score (<60): ${poor.map(r => `${r.party} (${r.score})`).join(', ')}`);
    }
    console.log('');
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('review-promises.ts')) {
  const args = process.argv.slice(2);
  const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
  const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
  const verbose = args.includes('--verbose');

  reviewPromises({
    party: partyArg,
    year: yearArg ? parseInt(yearArg) : undefined,
    verbose,
  }).catch(console.error);
}
