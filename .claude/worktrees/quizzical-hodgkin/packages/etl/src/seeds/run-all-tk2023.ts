import { seedPvvPromises } from './pvv-promises-tk2023';
import { seedNscPromises } from './nsc-promises-tk2023';
import { seedBbbPromises } from './bbb-promises-tk2023';
import { seedD66Promises } from './d66-promises-tk2023';
import { seedCdaPromises } from './cda-promises-tk2023';
import { seedSpPromises } from './sp-promises-tk2023';
import { seedPvddPromises } from './pvdd-promises-tk2023';
import { seedCuPromises } from './cu-promises-tk2023';

async function main() {
  const seeders = [
    { name: 'PVV', fn: seedPvvPromises },
    { name: 'NSC', fn: seedNscPromises },
    { name: 'BBB', fn: seedBbbPromises },
    { name: 'D66', fn: seedD66Promises },
    { name: 'CDA', fn: seedCdaPromises },
    { name: 'SP', fn: seedSpPromises },
    { name: 'PvdD', fn: seedPvddPromises },
    { name: 'CU', fn: seedCuPromises },
  ];

  for (const { name, fn } of seeders) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Seeding ${name}...`);
    console.log('='.repeat(60));
    try {
      await fn();
    } catch (err) {
      console.error(`❌ ${name} failed:`, err);
    }
  }
}

main().catch(console.error);
