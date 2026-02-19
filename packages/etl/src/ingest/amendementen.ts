/**
 * Ingest Amendementen (Amendments) from Tweede Kamer OData API
 *
 * Amendments are stored in the same Motion table as Moties,
 * with soort = 'Amendement'. The stemmingen pipeline automatically
 * links votes to them via the Zaak ID.
 *
 * Supports incremental mode: when no limit is specified, only fetches
 * amendments newer than the most recent one in the database.
 */

import { PrismaClient } from '@prisma/client';
import { tkClient } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

export async function ingestAmendementen(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Amendementen ingest...');

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
      // Find the most recent amendment in the DB
      const latest = await prisma.motion.findFirst({
        where: { soort: 'Amendement' },
        orderBy: { dateIntroduced: 'desc' },
        select: { dateIntroduced: true },
      });

      if (latest?.dateIntroduced) {
        // Go back 7 days from latest to catch any late-arriving amendments
        const lookback = new Date(latest.dateIntroduced);
        lookback.setDate(lookback.getDate() - 7);
        startDate = lookback.toISOString();
        console.log(`[INGEST] Incremental mode: fetching amendments since ${lookback.toISOString().split('T')[0]}`);
      } else {
        console.log(`[INGEST] No existing amendments found, full ingest from 2023`);
      }
    }

    const filter =
      `Verwijderd eq false and Soort eq 'Amendement' and GestartOp ge ${startDate}`;
    const amendementen = await tkClient.getZakenBySoort('Amendement', filter, limit);

    console.log(`[INGEST] Found ${amendementen.length} amendementen to process`);

    // Pre-load existing tkIds to skip unnecessary upserts
    const existingMotions = await prisma.motion.findMany({
      where: {
        tkId: { in: amendementen.map(a => a.Id) },
      },
      select: { tkId: true, dateIntroduced: true, status: true },
    });
    const existingMap = new Map(existingMotions.map(m => [m.tkId, m]));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const amendement of amendementen) {
      if (!amendement.GestartOp) {
        console.log(`[INGEST] ⚠️  Skipping amendement ${amendement.Id} (no date)`);
        skipped++;
        continue;
      }

      const existing = existingMap.get(amendement.Id);

      // Skip if amendment exists and status hasn't changed
      if (existing && existing.status === amendement.Status) {
        skipped++;
        continue;
      }

      // Use Onderwerp (subject description) as primary text, fallback to Titel
      const text = amendement.Onderwerp || amendement.Titel;

      // Upsert amendment (stored as a Motion with soort = 'Amendement')
      await prisma.motion.upsert({
        where: { tkId: amendement.Id },
        update: {
          tkNumber: amendement.Nummer || null,
          title: amendement.Titel,
          text,
          dateIntroduced: new Date(amendement.GestartOp),
          status: amendement.Status,
          soort: 'Amendement',
          parliamentId: tkParliament.id,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${amendement.Id}`,
          rawData: amendement as any,
        },
        create: {
          tkId: amendement.Id,
          tkNumber: amendement.Nummer || null,
          title: amendement.Titel,
          text,
          dateIntroduced: new Date(amendement.GestartOp),
          status: amendement.Status,
          soort: 'Amendement',
          parliamentId: tkParliament.id,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/detail?id=${amendement.Id}`,
          rawData: amendement as any,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
        if (created <= 20) {
          console.log(`[INGEST] ✅ ${amendement.Nummer || amendement.Id.substring(0, 8)} - ${(amendement.Onderwerp || amendement.Titel).substring(0, 80)}...`);
        }
      }
    }

    if (created > 20) {
      console.log(`[INGEST]    ... and ${created - 20} more`);
    }

    console.log(`[INGEST] ✅ Amendementen ingest complete: ${created} new, ${updated} updated, ${skipped} skipped`);
  } catch (error) {
    console.error('[INGEST] ❌ Amendementen ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
