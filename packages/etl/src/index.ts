/**
 * Main ETL script for CIVICSTAT
 * Ingests data from Tweede Kamer OData API
 */

import { ingestFracties } from './ingest/fracties.js';
import { ingestKamerleden } from './ingest/kamerleden.js';
import { ingestMoties } from './ingest/moties.js';
import { ingestStemmingen } from './ingest/stemmingen.js';

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
        const motiesLimit = args[1] ? parseInt(args[1]) : undefined;
        await ingestMoties(motiesLimit);
        break;

      case 'stemmingen':
        const stemmingenLimit = args[1] ? parseInt(args[1]) : undefined;
        await ingestStemmingen(stemmingenLimit);
        break;

      case 'all':
        console.log('🔄 Running full ingest pipeline...\n');
        await ingestFracties();
        await ingestKamerleden();
        await ingestMoties(100); // Start with recent 100
        await ingestStemmingen(50); // Start with recent 50
        console.log('\n✅ Full ingest pipeline complete!');
        break;

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
        console.log('  npm run ingest all                - Run full pipeline (limited data)');
        console.log('  npm run ingest quick              - Quick test ingest');
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
