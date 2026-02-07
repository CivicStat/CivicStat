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

      case 'match-promises': {
        const pmParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : args[1];
        const pmDryRun = args.includes('--dry-run');
        await matchPromisesToMotions({ party: pmParty, dryRun: pmDryRun });
        break;
      }

      case 'hoofdelijk': {
        console.log('🗳️  Ingesting Hoofdelijk (roll-call) votes specifically...\n');
        const hoofdelijkLimit = args[1] ? parseInt(args[1]) : 500;
        await ingestHoofdelijk(hoofdelijkLimit);
        break;
      }

      case 'quick':
        console.log('⚡ Running quick ingest (limited data)...\n');
        await ingestFracties();
        await ingestKamerleden();
        await ingestMoties(10);
        await ingestStemmingen(5);
        console.log('\n✅ Quick ingest complete!');
        break;

      default:
        console.log('Usage:');
        console.log('  npm run ingest fracties          - Ingest all fracties (parties)');
        console.log('  npm run ingest kamerleden         - Ingest all kamerleden (MPs)');
        console.log('  npm run ingest moties [limit]     - Ingest moties (motions)');
        console.log('  npm run ingest stemmingen [limit] - Ingest stemmingen (votes)');
        console.log('  npm run ingest all                - Run full pipeline (2025+)');
        console.log('  npm run ingest 2025               - Run 2025+ pipeline');
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
        console.log('  npm run ingest match-promises               - Match all promises to motions');
        console.log('  npm run ingest match-promises --party VVD   - Match VVD promises only');
        console.log('  npm run ingest match-promises --dry-run     - Preview matches without storing');
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
