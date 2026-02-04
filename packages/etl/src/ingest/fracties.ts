/**
 * Ingest Fracties (Partijen) from Tweede Kamer OData API
 */

import { PrismaClient } from '@ntp/db';
import { tkClient, type TKFractie } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestFracties(): Promise<void> {
  console.log('[INGEST] Starting Fracties ingest...');

  try {
    // Fetch all active fracties
    const fracties = await tkClient.getFracties();

    console.log(`[INGEST] Found ${fracties.length} fracties`);

    for (const fractie of fracties) {
      // Save raw data to audit trail
      await prisma.rawIngest.create({
        data: {
          source: 'TK_ODATA',
          resourceType: 'Fractie',
          resourceId: fractie.Id,
          payload: fractie as any,
        },
      });

      // Upsert party
      await prisma.party.upsert({
        where: { tkId: fractie.Id },
        update: {
          name: fractie.Naam,
          abbreviation: fractie.Afkorting || fractie.NaamKort,
          startDate: new Date(fractie.DatumActief),
          endDate: fractie.DatumInactief ? new Date(fractie.DatumInactief) : null,
        },
        create: {
          tkId: fractie.Id,
          name: fractie.Naam,
          abbreviation: fractie.Afkorting || fractie.NaamKort,
          startDate: new Date(fractie.DatumActief),
          endDate: fractie.DatumInactief ? new Date(fractie.DatumInactief) : null,
          colorNeutral: null, // We'll set this manually later
        },
      });

      console.log(`[INGEST] ✅ ${fractie.Naam} (${fractie.Afkorting})`);
    }

    console.log('[INGEST] ✅ Fracties ingest complete');
  } catch (error) {
    console.error('[INGEST] ❌ Fracties ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
