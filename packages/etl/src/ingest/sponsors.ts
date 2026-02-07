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
 * Fetch all ZaakActor records matching the filter, with pagination
 */
async function fetchAllZaakActors(filter: string): Promise<TKZaakActor[]> {
  const allItems: TKZaakActor[] = [];
  let url: string | null =
    `${TK_API_BASE}/ZaakActor?$filter=${encodeURIComponent(filter)}&$count=true&$orderby=GewijzigdOp desc`;

  while (url) {
    console.log(`[TK API] Fetching: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TK API error: ${response.status} ${response.statusText} - ${body}`);
    }
    const data: ODataResponse<TKZaakActor> = await response.json();
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
    // Fetch ZaakActor records: Indiener + Medeindiener, with a Persoon_Id (= MP, not minister/commissie)
    const filter =
      "Verwijderd eq false and (Relatie eq 'Indiener' or Relatie eq 'Medeindiener') and Persoon_Id ne null";
    const actors = await fetchAllZaakActors(filter);
    console.log(`[INGEST] Found ${actors.length} ZaakActor sponsor records`);

    // Build lookup maps
    console.log('[INGEST] Building lookup maps...');
    const { motionMap, mpMap } = await buildLookupMaps();
    console.log(`[INGEST] Lookup maps: ${motionMap.size} motions, ${mpMap.size} MPs`);

    let created = 0;
    let updated = 0;
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

        const role = actor.Relatie === 'Indiener' ? 'indiener' : 'mede-indiener';

        const result = await prisma.motionSponsor.upsert({
          where: {
            motionId_mpId: { motionId, mpId },
          },
          update: { role },
          create: { motionId, mpId, role },
        });

        // Simple heuristic: if createdAt === updatedAt it's new
        created++;
      } catch (err: any) {
        // Unique constraint violations are fine (already exists)
        if (err?.code === 'P2002') {
          updated++;
        } else {
          errors++;
          if (errors <= 5) {
            console.error(`[INGEST] ❌ Failed for ZaakActor ${actor.Id}:`, err);
          }
        }
      }
    }

    console.log(`[INGEST] ✅ MotionSponsor ingest complete:`);
    console.log(`   Created/updated: ${created}`);
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
