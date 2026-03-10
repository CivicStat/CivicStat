/**
 * Ingest Moties from Tweede Kamer OData API
 *
 * Only ingests Zaak items with Soort='Motie'. Amendementen and Wetsvoorstellen
 * are handled by their respective dedicated ingest scripts (amendementen.ts,
 * wetsvoorstellen.ts) which use the correct API soort filters ('Amendement'
 * and 'Wetgeving' respectively).
 *
 * Supports incremental mode: when no limit is specified, only fetches
 * items newer than the most recent one in the database.
 * This reduces hourly sync from ~40min (12K upserts) to ~30s (new only).
 */

import { PrismaClient } from '@prisma/client';
import { tkClient, type TKBesluit } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestMoties(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Moties ingest...');

  try {
    // Resolve TK parliament ID for linking
    const tkParliament = await prisma.parliament.findFirst({
      where: { shortName: 'Tweede Kamer' },
      select: { id: true },
    });
    if (!tkParliament) {
      throw new Error('Tweede Kamer parliament not found in DB');
    }

    // Determine start date: if no limit, use incremental mode
    let startDate = '2023-01-01T00:00:00Z';

    if (!limit) {
      // Find the most recent motie in the DB
      const latest = await prisma.motion.findFirst({
        where: { soort: 'Motie' },
        orderBy: { dateIntroduced: 'desc' },
        select: { dateIntroduced: true },
      });

      if (latest?.dateIntroduced) {
        // Go back 7 days from latest to catch any late-arriving motions
        const lookback = new Date(latest.dateIntroduced);
        lookback.setDate(lookback.getDate() - 7);
        startDate = lookback.toISOString();
        console.log(`[INGEST] Incremental mode: fetching moties since ${lookback.toISOString().split('T')[0]}`);
      } else {
        console.log(`[INGEST] No existing moties found, full ingest from 2023`);
      }
    }

    const filter =
      `Verwijderd eq false and Soort eq 'Motie' and GestartOp ge ${startDate}`;
    const besluiten = await tkClient.getBesluiten(filter, limit);

    console.log(`[INGEST] Found ${besluiten.length} moties to process`);

    // Pre-load existing tkIds to skip unnecessary upserts
    const existingMotions = await prisma.motion.findMany({
      where: {
        tkId: { in: besluiten.map(b => b.Id) },
      },
      select: { tkId: true, dateIntroduced: true, status: true },
    });
    const existingMap = new Map(existingMotions.map(m => [m.tkId, m]));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const besluit of besluiten) {
      if (!besluit.GestartOp) {
        console.log(`[INGEST] ⚠️  Skipping motie ${besluit.Id} (no date)`);
        skipped++;
        continue;
      }

      const existing = existingMap.get(besluit.Id);

      // Skip if motion exists and status hasn't changed
      if (existing && existing.status === besluit.Status) {
        skipped++;
        continue;
      }

      // Upsert motion (new or status changed)
      await prisma.motion.upsert({
        where: { tkId: besluit.Id },
        update: {
          tkNumber: besluit.Nummer || null,
          title: besluit.Titel,
          text: besluit.Onderwerp || besluit.Titel,
          dateIntroduced: new Date(besluit.GestartOp),
          status: besluit.Status,
          soort: 'Motie',
          parliamentId: tkParliament.id,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${besluit.Id}`,
          rawData: besluit as any,
        },
        create: {
          tkId: besluit.Id,
          tkNumber: besluit.Nummer || null,
          title: besluit.Titel,
          text: besluit.Onderwerp || besluit.Titel,
          dateIntroduced: new Date(besluit.GestartOp),
          status: besluit.Status,
          soort: 'Motie',
          parliamentId: tkParliament.id,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${besluit.Id}`,
          rawData: besluit as any,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
        if (created <= 20) {
          console.log(`[INGEST] ✅ ${besluit.Nummer || besluit.Id.substring(0, 8)} - ${besluit.Titel.substring(0, 60)}...`);
        }
      }
    }

    if (created > 20) {
      console.log(`[INGEST]    ... and ${created - 20} more`);
    }

    console.log(`[INGEST] ✅ Moties ingest complete: ${created} new, ${updated} updated, ${skipped} skipped`);
  } catch (error) {
    console.error('[INGEST] ❌ Moties ingest failed:', error);
    throw error;
  }
}
