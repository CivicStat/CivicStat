/**
 * Ingest Besluiten (Moties) from Tweede Kamer OData API
 */

import { PrismaClient } from '@ntp/db';
import { tkClient, type TKBesluit } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestMoties(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Moties ingest...');

  try {
    // Fetch recent moties
    const filter = "Verwijderd eq false and Soort eq 'Motie' and DatumIndiening ne null";
    const besluiten = limit
      ? await tkClient.getBesluiten(filter, limit)
      : await tkClient.getBesluiten(filter);

    console.log(`[INGEST] Found ${besluiten.length} moties`);

    for (const besluit of besluiten) {
      if (!besluit.DatumIndiening) {
        console.log(`[INGEST] ⚠️  Skipping motie ${besluit.Id} (no date)`);
        continue;
      }

      // Save raw data
      await prisma.rawIngest.create({
        data: {
          source: 'TK_ODATA',
          resourceType: 'Besluit',
          resourceId: besluit.Id,
          payload: besluit as any,
        },
      });

      // Upsert motion
      await prisma.motion.upsert({
        where: { tkId: besluit.Id },
        update: {
          tkNumber: besluit.Nummer || null,
          title: besluit.Titel,
          text: besluit.Tekst,
          dateIntroduced: new Date(besluit.DatumIndiening),
          status: besluit.Status,
          soort: besluit.Soort,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${besluit.Id}`,
          rawData: besluit as any,
        },
        create: {
          tkId: besluit.Id,
          tkNumber: besluit.Nummer || null,
          title: besluit.Titel,
          text: besluit.Tekst,
          dateIntroduced: new Date(besluit.DatumIndiening),
          status: besluit.Status,
          soort: besluit.Soort,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${besluit.Id}`,
          rawData: besluit as any,
        },
      });

      console.log(`[INGEST] ✅ ${besluit.Nummer || besluit.Id.substring(0, 8)} - ${besluit.Titel.substring(0, 60)}...`);
    }

    console.log('[INGEST] ✅ Moties ingest complete');
  } catch (error) {
    console.error('[INGEST] ❌ Moties ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
