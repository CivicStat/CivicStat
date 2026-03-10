/**
 * Ingest Wetsvoorstellen (Bills) from Tweede Kamer OData API
 *
 * Bills are stored in the same Motion table as Moties and Amendementen,
 * with soort = 'Wetsvoorstel'. The stemmingen pipeline automatically
 * links votes to them via the Zaak ID.
 *
 * Supports incremental mode: when no limit is specified, only fetches
 * bills newer than the most recent one in the database.
 */

import { PrismaClient } from '@prisma/client';
import { tkClient } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestWetsvoorstellen(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Wetsvoorstellen ingest...');

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
      // Find the most recent wetsvoorstel in the DB
      const latest = await prisma.motion.findFirst({
        where: { soort: 'Wetsvoorstel' },
        orderBy: { dateIntroduced: 'desc' },
        select: { dateIntroduced: true },
      });

      if (latest?.dateIntroduced) {
        // Go back 7 days from latest to catch any late-arriving bills
        const lookback = new Date(latest.dateIntroduced);
        lookback.setDate(lookback.getDate() - 7);
        startDate = lookback.toISOString();
        console.log(`[INGEST] Incremental mode: fetching wetsvoorstellen since ${lookback.toISOString().split('T')[0]}`);
      } else {
        console.log(`[INGEST] No existing wetsvoorstellen found, full ingest from 2023`);
      }
    }

    const filter =
      `Verwijderd eq false and Soort eq 'Wetgeving' and GestartOp ge ${startDate}`;
    const wetsvoorstellen = await tkClient.getZakenBySoort('Wetgeving', filter, limit);

    console.log(`[INGEST] Found ${wetsvoorstellen.length} wetsvoorstellen to process`);

    // Pre-load existing tkIds to skip unnecessary upserts
    const existingMotions = await prisma.motion.findMany({
      where: {
        tkId: { in: wetsvoorstellen.map(w => w.Id) },
      },
      select: { tkId: true, dateIntroduced: true, status: true },
    });
    const existingMap = new Map(existingMotions.map(m => [m.tkId, m]));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const wetsvoorstel of wetsvoorstellen) {
      if (!wetsvoorstel.GestartOp) {
        console.log(`[INGEST] ⚠️  Skipping wetsvoorstel ${wetsvoorstel.Id} (no date)`);
        skipped++;
        continue;
      }

      const existing = existingMap.get(wetsvoorstel.Id);

      // Skip if bill exists and status hasn't changed
      if (existing && existing.status === wetsvoorstel.Status) {
        skipped++;
        continue;
      }

      // Use Onderwerp (subject description) as primary text, fallback to Titel
      const text = wetsvoorstel.Onderwerp || wetsvoorstel.Titel;

      // Upsert bill (stored as a Motion with soort = 'Wetsvoorstel')
      await prisma.motion.upsert({
        where: { tkId: wetsvoorstel.Id },
        update: {
          tkNumber: wetsvoorstel.Nummer || null,
          title: wetsvoorstel.Titel,
          text,
          dateIntroduced: new Date(wetsvoorstel.GestartOp),
          status: wetsvoorstel.Status,
          soort: 'Wetsvoorstel',
          parliamentId: tkParliament.id,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${wetsvoorstel.Id}`,
          rawData: wetsvoorstel as any,
        },
        create: {
          tkId: wetsvoorstel.Id,
          tkNumber: wetsvoorstel.Nummer || null,
          title: wetsvoorstel.Titel,
          text,
          dateIntroduced: new Date(wetsvoorstel.GestartOp),
          status: wetsvoorstel.Status,
          soort: 'Wetsvoorstel',
          parliamentId: tkParliament.id,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${wetsvoorstel.Id}`,
          rawData: wetsvoorstel as any,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
        if (created <= 20) {
          console.log(`[INGEST] ✅ ${wetsvoorstel.Nummer || wetsvoorstel.Id.substring(0, 8)} - ${(wetsvoorstel.Onderwerp || wetsvoorstel.Titel).substring(0, 80)}...`);
        }
      }
    }

    if (created > 20) {
      console.log(`[INGEST]    ... and ${created - 20} more`);
    }

    console.log(`[INGEST] ✅ Wetsvoorstellen ingest complete: ${created} new, ${updated} updated, ${skipped} skipped`);
  } catch (error) {
    console.error('[INGEST] ❌ Wetsvoorstellen ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
