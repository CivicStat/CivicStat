/**
 * Ingest MotionSponsors from Tweede Kamer OData API
 *
 * Data model:
 * - ZaakActor (Relatie='Indiener'|'Medeindiener') with Persoon_Id → links MPs to Motions
 * - Zaak_Id maps to Motion.tkId
 * - Persoon_Id maps to Mp.tkId
 *
 * This populates the MotionSponsor join table which is critical for
 * initiative tracking in the analytical model (IAS scores).
 *
 * Supports incremental mode: only fetches sponsors modified since the
 * latest record in the DB, reducing hourly sync from 80+ min to ~10s.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TK_API_BASE = 'https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0';

interface TKZaakActor {
  Id: string;
  Zaak_Id: string;
  ActorNaam: string;
  ActorFractie: string | null;
  ActorAfkorting: string | null;
  Functie: string | null;
  Relatie: string;
  Persoon_Id: string | null;
  Fractie_Id: string | null;
  Commissie_Id: string | null;
  GewijzigdOp: string;
  Verwijderd: boolean;
}

interface ODataResponse<T> {
  '@odata.context': string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
}

/**
 * Fetch all ZaakActor records matching the filter, with pagination and retry
 */
async function fetchAllZaakActors(filter: string): Promise<TKZaakActor[]> {
  const allItems: TKZaakActor[] = [];
  let url: string | null =
    `${TK_API_BASE}/ZaakActor?$filter=${encodeURIComponent(filter)}&$count=true&$orderby=GewijzigdOp desc`;

  while (url) {
    console.log(`[TK API] Fetching: ${url}`);

    let response: Response | null = null;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(url);
      if (response.ok) break;
      if ((response.status === 503 || response.status === 429) && attempt < MAX_RETRIES) {
        const delay = attempt * 5000;
        console.warn(`[TK API] ${response.status} on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const body = await response.text().catch(() => '');
      throw new Error(`TK API error: ${response.status} ${response.statusText} - ${body}`);
    }

    const data: ODataResponse<TKZaakActor> = await response!.json();
    allItems.push(...data.value);

    if (data['@odata.nextLink']) {
      url = data['@odata.nextLink'];
      console.log(`[TK API] Fetched ${allItems.length} total ZaakActor records...`);
    } else {
      url = null;
    }
  }

  return allItems;
}

/**
 * Build lookup maps for motions and MPs (tkId → internal id)
 */
async function buildLookupMaps() {
  const motions = await prisma.motion.findMany({ select: { id: true, tkId: true } });
  const mps = await prisma.mp.findMany({ select: { id: true, tkId: true } });

  const motionMap = new Map<string, string>();
  for (const m of motions) motionMap.set(m.tkId, m.id);

  const mpMap = new Map<string, string>();
  for (const mp of mps) mpMap.set(mp.tkId, mp.id);

  return { motionMap, mpMap };
}

export async function ingestSponsors(): Promise<void> {
  console.log('[INGEST] Starting MotionSponsor ingest...');

  try {
    // Determine incremental start date from latest sponsor's motion date
    let dateFilter = '';
    const latestMotionWithSponsor = await prisma.motionSponsor.findFirst({
      orderBy: { motion: { dateIntroduced: 'desc' } },
      select: { motion: { select: { dateIntroduced: true } } },
    });

    if (latestMotionWithSponsor?.motion?.dateIntroduced) {
      const lookback = new Date(latestMotionWithSponsor.motion.dateIntroduced);
      lookback.setDate(lookback.getDate() - 14); // 14-day lookback for late-arriving sponsors
      dateFilter = ` and GewijzigdOp ge ${lookback.toISOString()}`;
      console.log(`[INGEST] Incremental mode: fetching sponsors since ${lookback.toISOString().split('T')[0]}`);
    } else {
      console.log(`[INGEST] No existing sponsors found, full ingest`);
    }

    // Fetch ZaakActor records: Indiener + Medeindiener, with a Persoon_Id (= MP, not minister/commissie)
    const filter =
      `Verwijderd eq false and (Relatie eq 'Indiener' or Relatie eq 'Medeindiener') and Persoon_Id ne null${dateFilter}`;
    const actors = await fetchAllZaakActors(filter);
    console.log(`[INGEST] Found ${actors.length} ZaakActor sponsor records`);

    // Build lookup maps
    console.log('[INGEST] Building lookup maps...');
    const { motionMap, mpMap } = await buildLookupMaps();
    console.log(`[INGEST] Lookup maps: ${motionMap.size} motions, ${mpMap.size} MPs`);

    // Pre-load existing sponsors for skip check
    const existingSponsors = new Set<string>();
    const existingRecords = await prisma.motionSponsor.findMany({
      select: { motionId: true, mpId: true },
    });
    for (const r of existingRecords) {
      existingSponsors.add(`${r.motionId}:${r.mpId}`);
    }

    let created = 0;
    let skippedExisting = 0;
    let skippedNoMotion = 0;
    let skippedNoMp = 0;
    let errors = 0;

    for (const actor of actors) {
      try {
        const motionId = motionMap.get(actor.Zaak_Id);
        if (!motionId) {
          skippedNoMotion++;
          continue;
        }

        const mpId = mpMap.get(actor.Persoon_Id!);
        if (!mpId) {
          skippedNoMp++;
          continue;
        }

        // Skip if already exists
        const key = `${motionId}:${mpId}`;
        if (existingSponsors.has(key)) {
          skippedExisting++;
          continue;
        }

        const role = actor.Relatie === 'Indiener' ? 'indiener' : 'mede-indiener';

        await prisma.motionSponsor.upsert({
          where: {
            motionId_mpId: { motionId, mpId },
          },
          update: { role },
          create: { motionId, mpId, role },
        });

        created++;
        existingSponsors.add(key);
      } catch (err: any) {
        // Unique constraint violations are fine (already exists)
        if (err?.code === 'P2002') {
          skippedExisting++;
        } else {
          errors++;
          if (errors <= 5) {
            console.error(`[INGEST] ❌ Failed for ZaakActor ${actor.Id}:`, err);
          }
        }
      }
    }

    console.log(`[INGEST] ✅ MotionSponsor ingest complete:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped (already exists): ${skippedExisting}`);
    console.log(`   Skipped (no matching motion): ${skippedNoMotion}`);
    console.log(`   Skipped (no matching MP): ${skippedNoMp}`);
    console.log(`   Errors: ${errors}`);
  } catch (error) {
    console.error('[INGEST] ❌ MotionSponsor ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
