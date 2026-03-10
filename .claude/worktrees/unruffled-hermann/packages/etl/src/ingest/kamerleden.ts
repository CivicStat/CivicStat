/**
 * Ingest Personen (Kamerleden) from Tweede Kamer OData API
 */

import { PrismaClient } from '@prisma/client';
import { tkClient, type TKPersoon, type TKFractieZetelPersoon } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestKamerleden(): Promise<void> {
  console.log('[INGEST] Starting Kamerleden ingest...');

  try {
    // 1. Fetch all personen
    const personen = await tkClient.getPersonen();
    console.log(`[INGEST] Found ${personen.length} personen`);

    // 2. Fetch all fractie-zetel assignments
    const zetelPersonen = await tkClient.getFractieZetelPersonen();
    console.log(`[INGEST] Found ${zetelPersonen.length} fractie assignments`);

    const fractieZetels = await tkClient.getFractieZetels();
    console.log(`[INGEST] Found ${fractieZetels.length} fractie seats`);

    const fractieByZetelId = new Map<string, string>();
    for (const zetel of fractieZetels) {
      const fractieId =
        (zetel as any).Fractie_Id ||
        (zetel as any).FractieId ||
        (zetel as any).Fractie?.Id;
      if (fractieId) {
        fractieByZetelId.set(zetel.Id, fractieId);
      }
    }

    // 3. Create a map of current fractie per persoon
    const currentFractieMap = new Map<string, TKFractieZetelPersoon>();

    for (const zetel of zetelPersonen) {
      // Only active assignments (no TotEnMet or TotEnMet in future)
      if (!zetel.TotEnMet || new Date(zetel.TotEnMet) > new Date()) {
        currentFractieMap.set(zetel.Persoon_Id, zetel);
      }
    }

    // 4. Process each persoon
    for (const persoon of personen) {
      const zetel = currentFractieMap.get(persoon.Id);

      if (!zetel) {
        console.log(`[INGEST] ⚠️  Skipping ${persoon.Achternaam} (no active fractie)`);
        continue;
      }

      // Get party from database
      const fractieId = fractieByZetelId.get(zetel.FractieZetel_Id);

      if (!fractieId) {
        console.log(
          `[INGEST] ⚠️  Skipping ${persoon.Achternaam} (fractie seat not found: ${zetel.FractieZetel_Id})`
        );
        continue;
      }

      const party = await prisma.party.findUnique({
        where: { tkId: fractieId },
      });

      if (!party) {
        console.log(`[INGEST] ⚠️  Skipping ${persoon.Achternaam} (fractie not found: ${fractieId})`);
        continue;
      }

      // Raw ingest disabled to save storage

      // Upsert MP
      const fullName = [
        persoon.Voornamen || persoon.Initialen,
        persoon.Tussenvoegsel,
        persoon.Achternaam,
      ]
        .filter(Boolean)
        .join(' ');

      await prisma.mp.upsert({
        where: { tkId: persoon.Id },
        update: {
          name: fullName,
          initials: persoon.Initialen || null,
          prefix: persoon.Tussenvoegsel || null,
          surname: persoon.Achternaam,
          partyId: party.id,
          gender: persoon.Geslacht || null,
          startDate: new Date(zetel.Van),
          endDate: zetel.TotEnMet ? new Date(zetel.TotEnMet) : null,
        },
        create: {
          tkId: persoon.Id,
          name: fullName,
          initials: persoon.Initialen || null,
          prefix: persoon.Tussenvoegsel || null,
          surname: persoon.Achternaam,
          partyId: party.id,
          gender: persoon.Geslacht || null,
          startDate: new Date(zetel.Van),
          endDate: zetel.TotEnMet ? new Date(zetel.TotEnMet) : null,
        },
      });

      console.log(`[INGEST] ✅ ${fullName} (${party.abbreviation})`);
    }

    console.log('[INGEST] ✅ Kamerleden ingest complete');
  } catch (error) {
    console.error('[INGEST] ❌ Kamerleden ingest failed:', error);
    throw error;
  }
}
