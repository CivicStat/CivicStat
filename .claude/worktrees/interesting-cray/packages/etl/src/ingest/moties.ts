/**
 * Ingest Besluiten (Moties) from Tweede Kamer OData API
 */

import { PrismaClient } from '@prisma/client';
import { tkClient, type TKBesluit } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestMoties(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Moties ingest...');

  try {
    // Fetch moties - use broader date range to ensure vote-to-motion linking works
    // Votes from 2025 may relate to motions filed in 2024 or earlier
    const startYear = 2023; // Cover current parliament (since TK2023 elections)
    const filter =
      `Verwijderd eq false and Soort eq 'Motie' and GestartOp ge ${startYear}-01-01T00:00:00Z`;
    const besluiten = await tkClient.getBesluiten(filter, limit);

    console.log(`[INGEST] Found ${besluiten.length} moties`);

    for (const besluit of besluiten) {
      if (!besluit.GestartOp) {
        console.log(`[INGEST] ⚠️  Skipping motie ${besluit.Id} (no date)`);
        continue;
      }

      // Raw ingest disabled to save storage (rawData is stored on Motion)

      // Upsert motion
      await prisma.motion.upsert({
        where: { tkId: besluit.Id },
        update: {
          tkNumber: besluit.Nummer || null,
          title: besluit.Titel,
          text: besluit.Onderwerp || besluit.Titel, // Use Onderwerp as text, fallback to Titel
          dateIntroduced: new Date(besluit.GestartOp),
          status: besluit.Status,
          soort: besluit.Soort,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${besluit.Id}`,
          rawData: besluit as any,
        },
        create: {
          tkId: besluit.Id,
          tkNumber: besluit.Nummer || null,
          title: besluit.Titel,
          text: besluit.Onderwerp || besluit.Titel, // Use Onderwerp as text, fallback to Titel
          dateIntroduced: new Date(besluit.GestartOp),
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
  }
}
