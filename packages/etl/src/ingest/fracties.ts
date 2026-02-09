/**
 * Ingest Fracties (Partijen) from Tweede Kamer OData API
 */

import { PrismaClient } from '@prisma/client';
import { tkClient, type TKFractie } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

// TK OData sometimes uses full names as Afkorting.
// This map overrides those to match the short names used in Stemming data.
const ABBREVIATION_OVERRIDES: Record<string, string> = {
  'Nieuw Sociaal Contract': 'NSC',
  'BoerBurgerBeweging': 'BBB',
};

// Manually set brand colours for parties that don't have them in the API
const COLOR_OVERRIDES: Record<string, string> = {
  'NSC': '#005CA9',
};

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
      const rawAbbr = fractie.Afkorting || fractie.NaamKort || fractie.Naam || 'ONB';
      const abbreviation = ABBREVIATION_OVERRIDES[rawAbbr] || rawAbbr;
      const colorOverride = COLOR_OVERRIDES[abbreviation];

      // Upsert party
      await prisma.party.upsert({
        where: { tkId: fractie.Id },
        update: {
          name: partyName,
          abbreviation: abbreviation,
          startDate: new Date(fractie.DatumActief),
          endDate: fractie.DatumInactief ? new Date(fractie.DatumInactief) : null,
          ...(colorOverride ? { colorNeutral: colorOverride } : {}),
        },
        create: {
          tkId: fractie.Id,
          name: partyName,
          abbreviation: abbreviation,
          startDate: new Date(fractie.DatumActief),
          endDate: fractie.DatumInactief ? new Date(fractie.DatumInactief) : null,
          colorNeutral: colorOverride || null,
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
