/**
 * Main ETL script for CIVICSTAT
 * Ingests data from Tweede Kamer OData API
 */

import { ingestFracties } from './ingest/fracties.js';
import { ingestKamerleden } from './ingest/kamerleden.js';
import { ingestMoties } from './ingest/moties.js';
import { ingestStemmingen, ingestHoofdelijk } from './ingest/stemmingen.js';
import { ingestProgrammas } from './ingest/programmas.js';
import { ingestSponsors } from './ingest/sponsors.js';
import { runKeywordMatching } from './matching/keyword-match.js';
import { matchPromisesToMotions } from './matching/promise-motion-matcher.js';
import { seedVvdPromises } from './seeds/vvd-promises-tk2023.js';
import { seedGlpvdaPromises } from './seeds/glpvda-promises-tk2023.js';
import { seedPvvPromises } from './seeds/pvv-promises-tk2023.js';
import { seedNscPromises } from './seeds/nsc-promises-tk2023.js';
import { seedBbbPromises } from './seeds/bbb-promises-tk2023.js';
import { seedD66Promises } from './seeds/d66-promises-tk2023.js';
import { seedCdaPromises } from './seeds/cda-promises-tk2023.js';
import { seedSpPromises } from './seeds/sp-promises-tk2023.js';
import { seedPvddPromises } from './seeds/pvdd-promises-tk2023.js';
import { seedCuPromises } from './seeds/cu-promises-tk2023.js';
import { seedFvdPromises } from './seeds/fvd-promises-tk2023.js';
import { seedSgpPromises } from './seeds/sgp-promises-tk2023.js';
import { seedDenkPromises } from './seeds/denk-promises-tk2023.js';
import { seedVoltPromises } from './seeds/volt-promises-tk2023.js';
import { seedJa21Promises } from './seeds/ja21-promises-tk2023.js';
import { predictVotes } from './prediction/predict-vote.js';
import { purgeMatches } from './scripts/purge-matches.js';
import { generateReviewReport, applyReviewResults } from './scripts/review-matches.js';
import { parseAllPrograms } from './scripts/parse-program-pdf.js';
import { extractPromisesFromPrograms } from './scripts/extract-promises-from-program.js';
import { seedPromisesFromJson } from './scripts/seed-promises-json.js';
import { reviewPromises } from './scripts/review-promises.js';
import { ingestRegeerakkoord } from './scripts/ingest-regeerakkoord.js';
import { computeScorecards } from './scripts/compute-scorecards.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🚀 CIVICSTAT ETL - Tweede Kamer Data Ingest');
  console.log('==========================================\n');

  try {
    switch (command) {
      case 'fracties':
        await ingestFracties();
        break;

      case 'kamerleden':
        await ingestKamerleden();
        break;

      case 'moties':
        // Support both 'moties 5' and 'moties --limit 5'
        const motiesLimitArg = args.find(arg => arg === '--limit') ? args[args.indexOf('--limit') + 1] : args[1];
        const motiesLimit = motiesLimitArg ? parseInt(motiesLimitArg) : undefined;
        await ingestMoties(motiesLimit);
        break;

      case 'stemmingen':
        // Support both 'stemmingen 5' and 'stemmingen --limit 5'
        const stemmingenLimitArg = args.find(arg => arg === '--limit') ? args[args.indexOf('--limit') + 1] : args[1];
        const stemmingenLimit = stemmingenLimitArg ? parseInt(stemmingenLimitArg) : undefined;
        await ingestStemmingen(stemmingenLimit);
        break;

      case 'all':
        console.log('🔄 Running full ingest pipeline (2025+)...\n');
        await ingestFracties();
        await ingestKamerleden();
        await ingestMoties();
        await ingestStemmingen();
        await ingestSponsors();
        console.log('\n✅ Full ingest pipeline complete!');
        break;

      case '2025':
        console.log('🔄 Running 2025+ ingest...\n');
        await ingestFracties();
        await ingestKamerleden();
        await ingestMoties();
        await ingestStemmingen();
        console.log('\n✅ 2025 ingest complete!');
        break;

      case 'programs':
      case 'programmas': {
        const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const downloadOnly = args.includes('--download-only');
        const subCmd = args[1];
        
        if (subCmd === 'download') {
          await ingestProgrammas({ downloadOnly: true, year: yearArg ? parseInt(yearArg) : undefined, party: partyArg });
        } else {
          await ingestProgrammas({ year: yearArg ? parseInt(yearArg) : undefined, party: partyArg, downloadOnly });
        }
        break;
      }

      case 'match':
      case 'matching': {
        const limitArg = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;
        const partyArg = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const yearArg = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        const dryRun = args.includes('--dry-run');
        await runKeywordMatching({
          limit: limitArg ? parseInt(limitArg) : undefined,
          party: partyArg,
          year: yearArg ? parseInt(yearArg) : undefined,
          dryRun,
        });
        break;
      }

      case 'sponsors':
        await ingestSponsors();
        break;

      case 'seed-promises-vvd':
        await seedVvdPromises();
        break;

      case 'seed-promises-glpvda':
        await seedGlpvdaPromises();
        break;

      case 'seed-promises-pvv':
        await seedPvvPromises();
        break;

      case 'seed-promises-nsc':
        await seedNscPromises();
        break;

      case 'seed-promises-bbb':
        await seedBbbPromises();
        break;

      case 'seed-promises-d66':
        await seedD66Promises();
        break;

      case 'seed-promises-cda':
        await seedCdaPromises();
        break;

      case 'seed-promises-sp':
        await seedSpPromises();
        break;

      case 'seed-promises-pvdd':
        await seedPvddPromises();
        break;

      case 'seed-promises-cu':
        await seedCuPromises();
        break;

      case 'seed-promises-fvd':
        await seedFvdPromises();
        break;

      case 'seed-promises-sgp':
        await seedSgpPromises();
        break;

      case 'seed-promises-denk':
        await seedDenkPromises();
        break;

      case 'seed-promises-volt':
        await seedVoltPromises();
        break;

      case 'seed-promises-ja21':
        await seedJa21Promises();
        break;

      case 'seed-promises-all':
        console.log('🌱 Seeding all TK2023 promises...\n');
        await seedVvdPromises();
        await seedGlpvdaPromises();
        await seedPvvPromises();
        await seedNscPromises();
        await seedBbbPromises();
        await seedD66Promises();
        await seedCdaPromises();
        await seedSpPromises();
        await seedPvddPromises();
        await seedCuPromises();
        await seedFvdPromises();
        await seedSgpPromises();
        await seedDenkPromises();
        await seedVoltPromises();
        await seedJa21Promises();
        console.log('\n✅ All TK2023 promises seeded!');
        break;

      case 'match-promises': {
        const pmParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : args[1];
        const pmDryRun = args.includes('--dry-run');
        await matchPromisesToMotions({ party: pmParty, dryRun: pmDryRun });
        break;
      }

      case 'predict':
      case 'predict-votes': {
        const pvParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const pvDryRun = args.includes('--dry-run');
        const pvLimit = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;
        await predictVotes({ party: pvParty, dryRun: pvDryRun, limit: pvLimit ? parseInt(pvLimit) : undefined });
        break;
      }

      case 'hoofdelijk': {
        console.log('🗳️  Ingesting Hoofdelijk (roll-call) votes specifically...\n');
        const hoofdelijkLimit = args[1] ? parseInt(args[1]) : 500;
        await ingestHoofdelijk(hoofdelijkLimit);
        break;
      }

      case 'sync':
      case 'incremental':
        console.log('🔄 Running incremental sync...\n');
        await ingestMoties();
        await ingestStemmingen();
        await ingestSponsors();
        console.log('\n✅ Incremental sync complete!');
        break;

      case 'quick':
        console.log('⚡ Running quick ingest (limited data)...\n');
        await ingestFracties();
        await ingestKamerleden();
        await ingestMoties(10);
        await ingestStemmingen(5);
        console.log('\n✅ Quick ingest complete!');
        break;

      case 'purge-matches':
        await purgeMatches({
          confirm: args.includes('--confirm'),
          predictions: args.includes('--predictions'),
        });
        break;

      case 'review-matches':
        if (args[1] === 'apply') {
          await applyReviewResults(args[2]);
        } else {
          await generateReviewReport();
        }
        break;

      case 'parse-program':
      case 'parse-programs': {
        const ppParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const ppYear = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        await parseAllPrograms({ party: ppParty, year: ppYear ? parseInt(ppYear) : undefined });
        break;
      }

      case 'extract-promises': {
        const epParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const epYear = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        const epDryRun = args.includes('--dry-run');
        await extractPromisesFromPrograms({ party: epParty, year: epYear ? parseInt(epYear) : undefined, dryRun: epDryRun });
        break;
      }

      case 'seed-promises-json': {
        const sjParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const sjYear = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        const sjDryRun = args.includes('--dry-run');
        const sjReplace = args.includes('--replace');
        await seedPromisesFromJson({ party: sjParty, year: sjYear ? parseInt(sjYear) : undefined, dryRun: sjDryRun, replace: sjReplace });
        break;
      }

      case 'review-promises': {
        const rpParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const rpYear = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        const rpVerbose = args.includes('--verbose');
        await reviewPromises({ party: rpParty, year: rpYear ? parseInt(rpYear) : undefined, verbose: rpVerbose });
        break;
      }

      case 'regeerakkoord':
      case 'ingest-regeerakkoord': {
        const raAkkoord = args.find(a => a === '--akkoord') ? args[args.indexOf('--akkoord') + 1] : args[1];
        if (!raAkkoord || !['schoof', 'jetten'].includes(raAkkoord)) {
          console.log('Usage: npm run ingest regeerakkoord --akkoord schoof|jetten');
          console.log('       npm run ingest regeerakkoord --akkoord schoof --step parse|extract|seed|all');
          console.log('       npm run ingest regeerakkoord --akkoord jetten --dry-run');
          process.exit(1);
        }
        const raStep = args.find(a => a === '--step') ? args[args.indexOf('--step') + 1] as any : 'all';
        const raDryRun = args.includes('--dry-run');
        const raReplace = args.includes('--replace');
        await ingestRegeerakkoord({ akkoord: raAkkoord as 'schoof' | 'jetten', step: raStep, dryRun: raDryRun, replace: raReplace });
        break;
      }

      case 'compute-scorecards': {
        const csParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const csYear = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        await computeScorecards({ party: csParty, year: csYear ? parseInt(csYear) : undefined });
        break;
      }

      default:
        console.log('Usage:');
        console.log('  npm run ingest fracties          - Ingest all fracties (parties)');
        console.log('  npm run ingest kamerleden         - Ingest all kamerleden (MPs)');
        console.log('  npm run ingest moties [limit]     - Ingest moties (motions)');
        console.log('  npm run ingest stemmingen [limit] - Ingest stemmingen (votes)');
        console.log('  npm run ingest all                - Run full pipeline (2025+)');
        console.log('  npm run ingest 2025               - Run 2025+ pipeline');
        console.log('  npm run ingest sync               - Incremental sync (moties + stemmingen + sponsors)');
        console.log('  npm run ingest quick              - Quick test ingest');
        console.log('  npm run ingest sponsors            - Ingest motion sponsors (ZaakActor)');
        console.log('  npm run ingest hoofdelijk [limit]   - Ingest roll-call votes (individual MP data)');
        console.log('  npm run ingest programs            - Ingest verkiezingsprogrammas');
        console.log('  npm run ingest programs download   - Download PDFs only');
        console.log('  npm run ingest programs --year 2023       - Only TK2023');
        console.log('  npm run ingest programs --party VVD       - Only VVD');
        console.log('  npm run ingest match                       - Run keyword matching');
        console.log('  npm run ingest match --dry-run             - Preview matches');
        console.log('  npm run ingest match --limit 50            - Match first 50 motions');
        console.log('  npm run ingest match --party VVD           - Match only VVD');
        console.log('  npm run ingest seed-promises-vvd           - Seed VVD TK2023 promises');
        console.log('  npm run ingest seed-promises-glpvda        - Seed GL-PvdA TK2023 promises');
        console.log('  npm run ingest seed-promises-pvv           - Seed PVV TK2023 promises');
        console.log('  npm run ingest seed-promises-nsc           - Seed NSC TK2023 promises');
        console.log('  npm run ingest seed-promises-bbb           - Seed BBB TK2023 promises');
        console.log('  npm run ingest seed-promises-d66           - Seed D66 TK2023 promises');
        console.log('  npm run ingest seed-promises-cda           - Seed CDA TK2023 promises');
        console.log('  npm run ingest seed-promises-sp            - Seed SP TK2023 promises');
        console.log('  npm run ingest seed-promises-pvdd          - Seed PvdD TK2023 promises');
        console.log('  npm run ingest seed-promises-cu            - Seed CU TK2023 promises');
        console.log('  npm run ingest seed-promises-fvd           - Seed FvD TK2023 promises');
        console.log('  npm run ingest seed-promises-sgp           - Seed SGP TK2023 promises');
        console.log('  npm run ingest seed-promises-denk          - Seed DENK TK2023 promises');
        console.log('  npm run ingest seed-promises-volt          - Seed Volt TK2023 promises');
        console.log('  npm run ingest seed-promises-ja21          - Seed JA21 TK2023 promises');
        console.log('  npm run ingest seed-promises-all           - Seed ALL party TK2023 promises');
        console.log('  npm run ingest match-promises               - Match all promises to motions');
        console.log('  npm run ingest match-promises --party VVD   - Match VVD promises only');
        console.log('  npm run ingest match-promises --dry-run     - Preview matches without storing');
        console.log('  npm run ingest predict                       - Run vote prediction engine');
        console.log('  npm run ingest predict --party VVD            - Predict for VVD only');
        console.log('  npm run ingest predict --dry-run              - Preview predictions');
        console.log('  npm run ingest purge-matches                  - Preview match purge');
        console.log('  npm run ingest purge-matches --confirm        - Delete all matches');
        console.log('  npm run ingest purge-matches --confirm --predictions - Delete matches + predictions');
        console.log('  npm run ingest review-matches                 - Generate match review report');
        console.log('  npm run ingest review-matches apply           - Apply reviewed corrections');
        console.log('');
        console.log('  --- Promise Expansion Pipeline (Batch A+) ---');
        console.log('  npm run ingest parse-program                   - Parse all TK2023 PDFs to JSON');
        console.log('  npm run ingest parse-program --party VVD        - Parse only VVD PDF');
        console.log('  npm run ingest parse-program --year 2025        - Parse TK2025 PDFs');
        console.log('  npm run ingest extract-promises                 - Extract promises from all programs (LLM)');
        console.log('  npm run ingest extract-promises --party VVD     - Extract only VVD promises');
        console.log('  npm run ingest extract-promises --dry-run       - Preview extraction (no API calls)');
        console.log('  npm run ingest seed-promises-json               - Seed promises from JSON files');
        console.log('  npm run ingest seed-promises-json --party VVD   - Seed only VVD promises');
        console.log('  npm run ingest seed-promises-json --replace     - Delete existing before seeding');
        console.log('  npm run ingest seed-promises-json --dry-run     - Preview seeding');
        console.log('  npm run ingest review-promises                  - Quality review of extracted promises');
        console.log('  npm run ingest review-promises --verbose        - Show individual issues');
        console.log('');
        console.log('  --- Regeerakkoord Pipeline (Batch G1) ---');
        console.log('  npm run ingest regeerakkoord --akkoord schoof            - Full pipeline Kabinet-Schoof');
        console.log('  npm run ingest regeerakkoord --akkoord jetten            - Full pipeline Kabinet-Jetten');
        console.log('  npm run ingest regeerakkoord --akkoord schoof --step parse    - Parse PDF only');
        console.log('  npm run ingest regeerakkoord --akkoord schoof --step extract  - Extract promises (Claude API)');
        console.log('  npm run ingest regeerakkoord --akkoord schoof --step seed     - Seed to database only');
        console.log('  npm run ingest regeerakkoord --akkoord jetten --dry-run       - Preview without changes');
        console.log('  npm run ingest regeerakkoord --akkoord jetten --replace       - Replace existing promises');
        console.log('');
        console.log('  --- Pre-computed Scorecards ---');
        console.log('  npm run ingest compute-scorecards                    - Compute all party scorecards');
        console.log('  npm run ingest compute-scorecards --party VVD        - Compute for one party');
        console.log('  npm run ingest compute-scorecards --year 2023        - Compute for one year');
        console.log('\nExamples:');
        console.log('  npm run ingest moties 50          - Ingest 50 most recent moties');
        console.log('  npm run ingest quick              - Quick test with minimal data');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ETL failed:', error);
    process.exit(1);
  }
}

main();
