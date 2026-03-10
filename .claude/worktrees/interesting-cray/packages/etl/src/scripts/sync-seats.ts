/**
 * Sync party seat counts (fractiegrootte) from the Tweede Kamer OData API.
 *
 * Uses Fractie.AantalZetels as the primary source of truth.
 * Matches on tkId (Fractie.Id) for reliable linking, with abbreviation
 * fallback for parties that may not have a tkId yet.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TK_API = 'https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0';

interface TKFractieSeat {
  Id: string;
  Afkorting: string;
  NaamNL: string;
  AantalZetels: number;
  DatumActief: string;
  DatumInactief: string | null;
}

export async function syncSeats(): Promise<void> {
  console.log('[SYNC-SEATS] Syncing party seat counts from TK API...\n');

  try {
    // Fetch all active fracties with seat counts
    const url = `${TK_API}/Fractie?$filter=Verwijderd eq false and DatumInactief eq null&$select=Id,Afkorting,NaamNL,AantalZetels&$orderby=AantalZetels desc`;

    console.log(`[SYNC-SEATS] Fetching: ${url}\n`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TK API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const fracties: TKFractieSeat[] = data.value;

    console.log(`[SYNC-SEATS] Found ${fracties.length} active fracties\n`);

    // Pre-load all parties from DB for matching
    const allParties = await prisma.party.findMany({
      select: { id: true, tkId: true, abbreviation: true, name: true },
    });

    // Build lookup maps
    const byTkId = new Map(allParties.filter(p => p.tkId).map(p => [p.tkId!, p]));
    const byAbbr = new Map(allParties.map(p => [p.abbreviation.toLowerCase(), p]));

    let updated = 0;
    let skipped = 0;

    for (const fractie of fracties) {
      const seats = fractie.AantalZetels;

      if (!seats || seats === 0) {
        console.log(`[SYNC-SEATS] ⚠ ${fractie.Afkorting}: no seat count in API, skipping`);
        skipped++;
        continue;
      }

      // Match by tkId first (most reliable), then by abbreviation
      let party = byTkId.get(fractie.Id);
      if (!party) {
        party = byAbbr.get(fractie.Afkorting.toLowerCase());
      }

      if (!party) {
        console.log(`[SYNC-SEATS] ⚠ ${fractie.Afkorting} (${seats} seats): no matching party in DB, skipping`);
        skipped++;
        continue;
      }

      await prisma.party.update({
        where: { id: party.id },
        data: {
          seats: seats,
          seatsUpdatedAt: new Date(),
        },
      });

      console.log(`[SYNC-SEATS] ✅ ${party.abbreviation.padEnd(20)} ${seats} zetels`);
      updated++;
    }

    console.log(`\n[SYNC-SEATS] Updated ${updated} parties, skipped ${skipped}`);

    // Verification: print all parties with seats
    const partiesWithSeats = await prisma.party.findMany({
      where: { seats: { gt: 0 } },
      orderBy: { seats: 'desc' },
      select: { abbreviation: true, seats: true, seatsUpdatedAt: true },
    });

    console.log('\n[SYNC-SEATS] Current seat distribution:');
    let totalSeats = 0;
    for (const p of partiesWithSeats) {
      console.log(`  ${p.abbreviation.padEnd(20)} ${String(p.seats).padStart(3)} zetels`);
      totalSeats += p.seats!;
    }
    console.log(`  ${'TOTAAL'.padEnd(20)} ${String(totalSeats).padStart(3)} zetels (should be 150)`);

    if (totalSeats !== 150) {
      console.log(`\n[SYNC-SEATS] ⚠ Total seats is ${totalSeats}, expected 150. Some parties may be missing from the DB.`);
    }

    console.log('\n[SYNC-SEATS] ✅ Seat sync complete');
  } catch (error) {
    console.error('[SYNC-SEATS] ❌ Seat sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
