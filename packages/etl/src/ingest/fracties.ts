/**
 * Ingest Fracties (Partijen) from Tweede Kamer OData API
 */

import { PrismaClient } from '@prisma/client';
import { tkClient, type TKFractie } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestFracties(): Promise<void> {
  console.log('[INGEST] Starting Fracties ingest...');

  try {
    // Fetch all active fracties
    const fracties = await tkClient.getFracties();

    console.log(`[INGEST] Found ${fracties.length} fracties`);

    for (const fractie of fracties) {
      // Raw ingest disabled to save storage

      // Use Naam if available, otherwise fall back to Afkorting or NaamKort
      const partyName = fractie.Naam || fractie.Afkorting || fractie.NaamKort || 'Onbekend';
      const abbreviation = fractie.Afkorting || fractie.NaamKort || fractie.Naam || 'ONB';

      // Upsert party
      await prisma.party.upsert({
        where: { tkId: fractie.Id },
        update: {
          name: partyName,
          abbreviation: abbreviation,
          startDate: new Date(fractie.DatumActief),
          endDate: fractie.DatumInactief ? new Date(fractie.DatumInactief) : null,
        },
        create: {
          tkId: fractie.Id,
          name: partyName,
          abbreviation: abbreviation,
          startDate: new Date(fractie.DatumActief),
          endDate: fractie.DatumInactief ? new Date(fractie.DatumInactief) : null,
          colorNeutral: null, // We'll set this manually later
        },
      });

      console.log(`[INGEST] ✅ ${partyName} (${abbreviation})`);
    }

    console.log('[INGEST] ✅ Fracties ingest complete');
  } catch (error) {
    console.error('[INGEST] ❌ Fracties ingest failed:', error);
    throw error;
  }
}
