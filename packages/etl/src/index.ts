/**
 * Main ETL script for CIVICSTAT
 * Ingests data from Tweede Kamer OData API
 */

import { ingestFracties } from './ingest/fracties.js';
import { ingestKamerleden } from './ingest/kamerleden.js';
import { ingestMoties } from './ingest/moties.js';
import { ingestAmendementen } from './ingest/amendementen.js';
import { ingestWetsvoorstellen } from './ingest/wetsvoorstellen.js';
import { ingestStemmingen, ingestHoofdelijk, relinkOrphanedVotes } from './ingest/stemmingen.js';
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
import { syncSeats } from './scripts/sync-seats.js';
import { runSemanticMatching } from './matching/semantic-matcher.js';
import { runIncrementalMatch } from './matching/incremental-match.js';
import { initLangfuse, shutdownLangfuse } from './lib/langfuse.js';
import { parseMunicipalPrograms } from './scripts/parse-municipal-programs.js';
import { extractMunicipalPromises } from './scripts/extract-municipal-promises.js';
import { seedMunicipalPromises } from './scripts/seed-municipal-promises.js';
import { extractMunicipalPromises as extractMunicipalPromises2026 } from './scripts/extract-municipal-promises-2026.js';
import { seedMunicipalPromises as seedMunicipalPromises2026 } from './scripts/seed-municipal-promises-2026.js';
import { seedMunicipalVoteRecords } from './scripts/seed-municipal-vote-records.js';
import { runNotubizSync } from './municipal/notubiz-sync.js';
import { runORISync } from './municipal/ori-sync.js';
import { runEmbedPassages } from './scripts/embed-passages.js';
import { computePillar2Scores } from './scripts/compute-pillar2-scores.js';
import { computePillar3Scores } from './scripts/compute-pillar3-scores.js';
import { runEKSync } from './eerste-kamer/ek-sync.js';

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
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

      case 'amendementen': {
        const amLimitArg = args.find(arg => arg === '--limit') ? args[args.indexOf('--limit') + 1] : args[1];
        const amLimit = amLimitArg ? parseInt(amLimitArg) : undefined;
        await ingestAmendementen(amLimit);
        break;
      }

      case 'wetsvoorstellen': {
        const wvLimitArg = args.find(arg => arg === '--limit') ? args[args.indexOf('--limit') + 1] : args[1];
        const wvLimit = wvLimitArg ? parseInt(wvLimitArg) : undefined;
        await ingestWetsvoorstellen(wvLimit);
        break;
      }

      case 'stemmingen':
        // Support both 'stemmingen 5' and 'stemmingen --limit 5'
        const stemmingenLimitArg = args.find(arg => arg === '--limit') ? args[args.indexOf('--limit') + 1] : args[1];
        const stemmingenLimit = stemmingenLimitArg ? parseInt(stemmingenLimitArg) : undefined;
        await ingestStemmingen(stemmingenLimit);
        break;

      case 'relink-votes':
        await relinkOrphanedVotes();
        break;

      case 'all':
        console.log('🔄 Running full ingest pipeline (2025+)...\n');
        await ingestFracties();
        await syncSeats();
        await ingestKamerleden();
        await ingestMoties();
        await ingestAmendementen();
        await ingestWetsvoorstellen();
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
        initLangfuse(); // Enable AI call tracing
        try {
          await syncSeats();
          await ingestMoties();
          await ingestAmendementen();
          await ingestWetsvoorstellen();
          await ingestStemmingen();
          await ingestSponsors();
          // Incremental AI matching: match new motions against promises
          if (process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY) {
            console.log('\n🧠 Running incremental matching...');
            await runIncrementalMatch({ maxCostCents: 500 });
          } else {
            console.log('\n⏭️  Skipping incremental matching (no AI API key configured)');
          }
          // Recompute national scorecards to reflect new matches + votes
          console.log('\n📊 Recomputing national scorecards...');
          await computeScorecards();

          // Sync municipal parliaments and recompute their scorecards
          const municipalFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          for (const notubizSlug of ['amsterdam', 'den-haag']) {
            try {
              console.log(`\n🏛️  Syncing municipal data: ${notubizSlug}...`);
              await runNotubizSync({ parliament: notubizSlug, from: municipalFrom });
              console.log(`📊 Recomputing scorecards for ${notubizSlug}...`);
              await computeScorecards({ parliament: notubizSlug });
            } catch (err) {
              console.error(`  ⚠️  Municipal sync failed for ${notubizSlug}:`, err instanceof Error ? err.message : err);
            }
          }
          for (const oriSlug of ['rotterdam', 'utrecht']) {
            try {
              console.log(`\n🏛️  Syncing ORI data: ${oriSlug}...`);
              await runORISync({ parliament: oriSlug, from: municipalFrom });
              console.log(`📊 Recomputing scorecards for ${oriSlug}...`);
              await computeScorecards({ parliament: oriSlug });
            } catch (err) {
              console.error(`  ⚠️  ORI sync failed for ${oriSlug}:`, err instanceof Error ? err.message : err);
            }
          }

          // Sync Eerste Kamer
          try {
            console.log('\n🏛️  Syncing Eerste Kamer...');
            await runEKSync();
            console.log('📊 Recomputing scorecards for eerste-kamer...');
            await computeScorecards({ parliament: 'eerste-kamer' });
          } catch (err) {
            console.error('  ⚠️  Eerste Kamer sync failed:', err instanceof Error ? err.message : err);
          }

          console.log('\n✅ Incremental sync complete!');
        } finally {
          await shutdownLangfuse(); // Flush traces before exit
        }
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

      case 'seed-promises-tk2025': {
        const s25Party = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const s25DryRun = args.includes('--dry-run');
        const s25Replace = args.includes('--replace');
        console.log('🌱 Seeding TK2025 promises for all parties...\n');
        await seedPromisesFromJson({ party: s25Party, year: 2025, dryRun: s25DryRun, replace: s25Replace });
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
        const csParliament = args.find(a => a === '--parliament') ? args[args.indexOf('--parliament') + 1] : undefined;
        await computeScorecards({ party: csParty, year: csYear ? parseInt(csYear) : undefined, parliament: csParliament });
        break;
      }

      case 'compute-pillar2-scores':
      case 'pillar2': {
        const p2Year = args.find(a => a === '--year') ? args[args.indexOf('--year') + 1] : undefined;
        await computePillar2Scores({ year: p2Year ? parseInt(p2Year) : undefined });
        break;
      }

      case 'compute-pillar3-scores':
      case 'pillar3': {
        await computePillar3Scores();
        break;
      }

      case 'sync-seats':
        await syncSeats();
        break;

      case 'incremental-match': {
        const imLimit = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;
        const imDryRun = args.includes('--dry-run');
        const imMaxCost = args.find(a => a === '--max-cost') ? args[args.indexOf('--max-cost') + 1] : undefined;
        initLangfuse();
        try {
          await runIncrementalMatch({
            limit: imLimit ? parseInt(imLimit) : undefined,
            dryRun: imDryRun,
            maxCostCents: imMaxCost ? Math.round(parseFloat(imMaxCost) * 100) : undefined,
          });
        } finally {
          await shutdownLangfuse();
        }
        break;
      }

      case 'semantic-match':
      case 'semantic': {
        const smParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const smParliament = args.find(a => a === '--parliament') ? args[args.indexOf('--parliament') + 1] : undefined;
        const smLimit = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;
        const smConcurrency = args.find(a => a === '--concurrency') ? args[args.indexOf('--concurrency') + 1] : undefined;
        const smDryRun = args.includes('--dry-run');
        const smResume = args.includes('--resume');
        initLangfuse();
        try {
          await runSemanticMatching({
            party: smParty,
            parliament: smParliament,
            limit: smLimit ? parseInt(smLimit) : undefined,
            dryRun: smDryRun,
            resume: smResume,
            concurrency: smConcurrency ? parseInt(smConcurrency) : undefined,
          });
        } finally {
          await shutdownLangfuse();
        }
        break;
      }

      case 'parse-municipal':
      case 'parse-municipal-programs': {
        const pmcCity = args.find(a => a === '--city') ? args[args.indexOf('--city') + 1] : undefined;
        const pmcParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        await parseMunicipalPrograms({ city: pmcCity, party: pmcParty });
        break;
      }

      case 'extract-municipal':
      case 'extract-municipal-promises': {
        const emcCity = args.find(a => a === '--city') ? args[args.indexOf('--city') + 1] : undefined;
        const emcParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const emcDryRun = args.includes('--dry-run');
        initLangfuse();
        try {
          await extractMunicipalPromises({ city: emcCity, party: emcParty, dryRun: emcDryRun });
        } finally {
          await shutdownLangfuse();
        }
        break;
      }

      case 'seed-municipal':
      case 'seed-municipal-promises': {
        const smcCity = args.find(a => a === '--city') ? args[args.indexOf('--city') + 1] : undefined;
        const smcParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const smcDryRun = args.includes('--dry-run');
        const smcReplace = args.includes('--replace');
        await seedMunicipalPromises({ city: smcCity, party: smcParty, dryRun: smcDryRun, replace: smcReplace });
        break;
      }

      case 'seed-vote-records':
      case 'seed-municipal-votes': {
        const svrParliament = args.find(a => a === '--parliament') ? args[args.indexOf('--parliament') + 1] : undefined;
        if (!svrParliament) {
          console.log('Usage: npm run ingest seed-vote-records --parliament <slug>');
          console.log('  Slugs: amsterdam, den-haag');
          console.log('  Flags: --dry-run, --force');
          process.exit(1);
        }
        const svrDryRun = args.includes('--dry-run');
        const svrForce = args.includes('--force');
        await seedMunicipalVoteRecords({ parliament: svrParliament, dryRun: svrDryRun, force: svrForce });
        break;
      }

      case 'sync-municipal':
      case 'notubiz-sync': {
        const smSlug = args.find(a => a === '--parliament') ? args[args.indexOf('--parliament') + 1] : undefined;
        if (!smSlug) {
          console.log('Usage: pnpm dev -- sync-municipal --parliament <slug>');
          console.log('  Slugs: amsterdam, den-haag');
          console.log('  Flags: --from YYYY-MM-DD, --to YYYY-MM-DD');
          process.exit(1);
        }
        const smFrom = args.find(a => a === '--from') ? args[args.indexOf('--from') + 1] : undefined;
        const smTo = args.find(a => a === '--to') ? args[args.indexOf('--to') + 1] : undefined;
        await runNotubizSync({ parliament: smSlug, from: smFrom, to: smTo });
        console.log('\n📊 Recomputing scorecards...');
        await computeScorecards({ parliament: smSlug });
        break;
      }

      case 'sync-ori':
      case 'ori-sync': {
        const oriSlug = args.find(a => a === '--parliament') ? args[args.indexOf('--parliament') + 1] : undefined;
        if (!oriSlug) {
          console.log('Usage: pnpm dev -- sync-ori --parliament <slug>');
          console.log('  Slugs: rotterdam, utrecht');
          console.log('  Flags: --from YYYY-MM-DD, --to YYYY-MM-DD');
          process.exit(1);
        }
        const oriFrom = args.find(a => a === '--from') ? args[args.indexOf('--from') + 1] : undefined;
        const oriTo = args.find(a => a === '--to') ? args[args.indexOf('--to') + 1] : undefined;
        await runORISync({ parliament: oriSlug, from: oriFrom, to: oriTo });
        console.log('\n📊 Recomputing scorecards...');
        await computeScorecards({ parliament: oriSlug });
        break;
      }

      case 'sync-ek':
      case 'ek-sync':
      case 'eerste-kamer': {
        await runEKSync();
        console.log('\n📊 Recomputing scorecards...');
        await computeScorecards({ parliament: 'eerste-kamer' });
        break;
      }

      case 'extract-municipal-2026': {
        const em26City = args.find(a => a === '--city') ? args[args.indexOf('--city') + 1] : 'all';
        const em26Party = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const em26DryRun = args.includes('--dry-run');
        initLangfuse();
        try {
          await extractMunicipalPromises2026({ city: em26City, party: em26Party, dryRun: em26DryRun });
        } finally {
          await shutdownLangfuse();
        }
        break;
      }

      case 'embed-passages':
      case 'embed': {
        const epTarget = args.find(a => a === '--target') ? args[args.indexOf('--target') + 1] as any : 'all';
        const epParty = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const epLimit = args.find(a => a === '--limit') ? args[args.indexOf('--limit') + 1] : undefined;
        const epForce = args.includes('--force');
        await runEmbedPassages({
          target: epTarget,
          party: epParty,
          limit: epLimit ? parseInt(epLimit) : undefined,
          force: epForce,
        });
        break;
      }

      case 'seed-municipal-2026': {
        const sm26City = args.find(a => a === '--city') ? args[args.indexOf('--city') + 1] : 'all';
        const sm26Party = args.find(a => a === '--party') ? args[args.indexOf('--party') + 1] : undefined;
        const sm26DryRun = args.includes('--dry-run');
        const sm26Replace = args.includes('--replace');
        await seedMunicipalPromises2026({ city: sm26City, party: sm26Party, dryRun: sm26DryRun, replace: sm26Replace });
        break;
      }

      default:
        console.log('Usage:');
        console.log('  npm run ingest fracties          - Ingest all fracties (parties)');
        console.log('  npm run ingest kamerleden         - Ingest all kamerleden (MPs)');
        console.log('  npm run ingest moties [limit]     - Ingest moties (motions)');
        console.log('  npm run ingest amendementen [limit] - Ingest amendementen (amendments)');
        console.log('  npm run ingest wetsvoorstellen [limit] - Ingest wetsvoorstellen (bills)');
        console.log('  npm run ingest stemmingen [limit] - Ingest stemmingen (votes)');
        console.log('  npm run ingest all                - Run full pipeline (2025+)');
        console.log('  npm run ingest 2025               - Run 2025+ pipeline');
        console.log('  npm run ingest sync               - Incremental sync (moties + stemmingen + sponsors)');
        console.log('  npm run ingest quick              - Quick test ingest');
        console.log('  npm run ingest sponsors            - Ingest motion sponsors (ZaakActor)');
        console.log('  npm run ingest sync-seats           - Sync party seat counts from TK API');
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
        console.log('  npm run ingest seed-promises-json               - Seed promises from JSON files (default: TK2023)');
        console.log('  npm run ingest seed-promises-json --year 2025   - Seed TK2025 promises (auto-creates programs)');
        console.log('  npm run ingest seed-promises-json --party VVD   - Seed only VVD promises');
        console.log('  npm run ingest seed-promises-json --replace     - Delete existing before seeding');
        console.log('  npm run ingest seed-promises-json --dry-run     - Preview seeding');
        console.log('  npm run ingest seed-promises-tk2025             - Seed all 15 party TK2025 promises');
        console.log('  npm run ingest seed-promises-tk2025 --party VVD - Seed only VVD TK2025 promises');
        console.log('  npm run ingest seed-promises-tk2025 --dry-run   - Preview TK2025 seeding');
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
        console.log('');
        console.log('  --- Semantic Matching (Batch C) ---');
        console.log('  npm run ingest semantic-match                         - Run semantic matching (all promises)');
        console.log('  npm run ingest semantic-match --party VVD             - Match only VVD promises');
        console.log('  npm run ingest semantic-match --limit 20              - Process first 20 promises');
        console.log('  npm run ingest semantic-match --dry-run               - Preview candidates (no API calls)');
        console.log('  npm run ingest semantic-match --resume                - Resume from checkpoint');
        console.log('  npm run ingest semantic-match --concurrency 10        - Process N promises in parallel (default: 5)');
        console.log('');
        console.log('  --- Incremental Matching (auto-runs in sync) ---');
        console.log('  npm run ingest incremental-match                      - Match new motions against promises');
        console.log('  npm run ingest incremental-match --dry-run             - Preview candidates (no API calls)');
        console.log('  npm run ingest incremental-match --limit 10            - Process first 10 unmatched motions');
        console.log('  npm run ingest incremental-match --max-cost 5.00       - Set max cost in dollars (default: $5)');
        console.log('');
        console.log('  --- Municipal NotuBiz Sync ---');
        console.log('  npm run ingest sync-municipal --parliament amsterdam   - Sync Amsterdam motions from NotuBiz');
        console.log('  npm run ingest sync-municipal --parliament den-haag    - Sync Den Haag motions from NotuBiz');
        console.log('  npm run ingest sync-municipal --parliament den-haag --from 2024-01-01  - Sync from specific date');
        console.log('');
        console.log('  --- Municipal Promise Pipeline ---');
        console.log('  npm run ingest parse-municipal                         - Parse all municipal PDFs to JSON');
        console.log('  npm run ingest parse-municipal --city amsterdam         - Parse only Amsterdam');
        console.log('  npm run ingest parse-municipal --party PvdA             - Parse only PvdA');
        console.log('  npm run ingest extract-municipal                        - Extract promises from all municipal programs (LLM)');
        console.log('  npm run ingest extract-municipal --city amsterdam        - Extract only Amsterdam promises');
        console.log('  npm run ingest extract-municipal --city den-haag         - Extract only Den Haag promises');
        console.log('  npm run ingest extract-municipal --party PvdA            - Extract only PvdA promises');
        console.log('  npm run ingest extract-municipal --dry-run               - Preview extraction (no API calls)');
        console.log('  npm run ingest seed-municipal                            - Seed all municipal promises to DB');
        console.log('  npm run ingest seed-municipal --city amsterdam            - Seed only Amsterdam');
        console.log('  npm run ingest seed-municipal --party PvdA               - Seed only PvdA');
        console.log('  npm run ingest seed-municipal --dry-run                  - Preview seeding');
        console.log('  npm run ingest seed-municipal --replace                  - Delete existing before seeding');
        console.log('');
        console.log('  --- Municipal 2026 Promise Pipeline ---');
        console.log('  npm run ingest extract-municipal-2026                     - Extract 2026 promises from all municipal programs (LLM)');
        console.log('  npm run ingest extract-municipal-2026 --city amsterdam    - Extract only Amsterdam 2026 promises');
        console.log('  npm run ingest extract-municipal-2026 --city den-haag     - Extract only Den Haag 2026 promises');
        console.log('  npm run ingest extract-municipal-2026 --party vvd         - Extract only VVD 2026 promises');
        console.log('  npm run ingest extract-municipal-2026 --dry-run           - Preview extraction (no API calls)');
        console.log('  npm run ingest seed-municipal-2026                        - Seed all 2026 municipal promises to DB');
        console.log('  npm run ingest seed-municipal-2026 --city amsterdam       - Seed only Amsterdam 2026');
        console.log('  npm run ingest seed-municipal-2026 --city den-haag        - Seed only Den Haag 2026');
        console.log('  npm run ingest seed-municipal-2026 --city rotterdam       - Seed only Rotterdam 2026');
        console.log('  npm run ingest seed-municipal-2026 --city utrecht         - Seed only Utrecht 2026');
        console.log('  npm run ingest seed-municipal-2026 --party vvd            - Seed only VVD 2026');
        console.log('  npm run ingest seed-municipal-2026 --dry-run              - Preview seeding');
        console.log('  npm run ingest seed-municipal-2026 --replace              - Delete existing before seeding');
        console.log('');
        console.log('  --- Embedding Generation (pgvector) ---');
        console.log('  npm run ingest embed-passages                        - Embed all passages + motions');
        console.log('  npm run ingest embed-passages --target passages      - Only embed passages');
        console.log('  npm run ingest embed-passages --target motions       - Only embed motions');
        console.log('  npm run ingest embed-passages --party VVD            - Only embed VVD passages');
        console.log('  npm run ingest embed-passages --limit 500            - Process first N items');
        console.log('  npm run ingest embed-passages --force                - Re-embed existing');
        console.log('');
        console.log('  --- AI Provider (applies to all AI tasks) ---');
        console.log('  Set OPENROUTER_API_KEY in .env to use OpenRouter (recommended)');
        console.log('  Falls back to ANTHROPIC_API_KEY for direct Anthropic API');
        console.log('  Override model per task via environment variables:');
        console.log('    AI_MODEL_SEMANTIC_MATCH=anthropic/claude-sonnet-4-20250514');
        console.log('    AI_MODEL_EXTRACT=google/gemini-2.5-pro');
        console.log('    AI_MODEL=<model>  (override all tasks)');
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
