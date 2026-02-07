/**
 * Ingest Stemmingen (Votes) from Tweede Kamer OData API
 *
 * Data model:
 * - Besluit (vote decision) → has StemmingsSoort ("Hoofdelijk" or "Met handopsteken")
 * - Stemming (party/individual vote records) → linked to Besluit via Besluit_Id
 * - Zaak (motion/case) → linked to Besluit via expand
 * - Agendapunt → Activiteit → provides the vote date
 *
 * For "Hoofdelijk" (roll-call) votes: each Stemming has a Persoon_Id (individual MP vote)
 * For "Met handopsteken" votes: only party-level aggregates exist
 */

import { PrismaClient, VoteValue } from '@prisma/client';
import { tkClient, type TKBesluitVote, type TKStemming } from '../clients/tk-odata.js';

export { ingestHoofdelijk };

const prisma = new PrismaClient();

function mapVoteValue(soort: string): VoteValue {
  switch (soort) {
    case 'Voor':
      return VoteValue.FOR;
    case 'Tegen':
      return VoteValue.AGAINST;
    case 'Niet deelgenomen':
      return VoteValue.ABSTAIN;
    default:
      console.warn(`  ⚠️  Unknown vote type: "${soort}", mapping to ABSENT`);
      return VoteValue.ABSENT;
  }
}

/**
 * Extract the vote date from a Besluit's Agendapunt → Activiteit chain.
 * Falls back to Besluit.GewijzigdOp if the chain is incomplete.
 */
function extractVoteDate(besluit: TKBesluitVote): Date {
  const activiteit = besluit.Agendapunt?.Activiteit;
  if (activiteit?.Datum) {
    return new Date(activiteit.Datum);
  }
  // Fallback to GewijzigdOp
  return new Date(besluit.GewijzigdOp);
}

/**
 * Determine result string from BesluitSoort
 */
function extractResult(besluit: TKBesluitVote): string {
  if (besluit.BesluitSoort.includes('aangenomen')) return 'Aangenomen';
  if (besluit.BesluitSoort.includes('verworpen')) return 'Verworpen';
  return besluit.BesluitSoort;
}

/**
 * Build a descriptive title from the Besluit and related Zaak
 */
function buildTitle(besluit: TKBesluitVote): string {
  const zaak = besluit.Zaak?.[0];
  if (zaak?.Onderwerp) return zaak.Onderwerp;
  if (zaak?.Titel) return zaak.Titel;
  const agendapunt = besluit.Agendapunt;
  if (agendapunt?.Onderwerp) return agendapunt.Onderwerp;
  return besluit.BesluitTekst || `Besluit ${besluit.Id.substring(0, 8)}`;
}

export async function ingestStemmingen(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Stemmingen ingest...');

  try {
    // Pre-cache all lookup tables into memory for O(1) lookups
    // This avoids thousands of sequential DB round-trips
    console.log('[INGEST] Pre-caching MPs, Parties, and Motions...');
    const [allMps, allParties, allMotions] = await Promise.all([
      prisma.mp.findMany({ select: { id: true, tkId: true } }),
      prisma.party.findMany({ select: { id: true, tkId: true } }),
      prisma.motion.findMany({ select: { id: true, tkId: true } }),
    ]);
    const mpByTkId = new Map(allMps.map(m => [m.tkId, m.id]));
    const partyByTkId = new Map(allParties.map(p => [p.tkId, p.id]));
    const motionByTkId = new Map(allMotions.map(m => [m.tkId, m.id]));
    console.log(`[INGEST] Cached ${mpByTkId.size} MPs, ${partyByTkId.size} Parties, ${motionByTkId.size} Motions`);

    // Fetch vote decisions (Besluiten) with expanded relations
    console.log('[INGEST] Fetching Besluiten with StemmingsSoort...');
    const filter =
      "Verwijderd eq false and StemmingsSoort ne null and GewijzigdOp ge 2023-01-01T00:00:00Z";
    const besluiten = await tkClient.getVoteBesluiten(filter, limit);

    console.log(`[INGEST] Found ${besluiten.length} vote decisions (Besluiten)`);

    // Pre-load existing vote tkIds to skip already-ingested records
    const existingVotes = await prisma.vote.findMany({ select: { tkId: true } });
    const existingTkIds = new Set(existingVotes.map(v => v.tkId));
    const newBesluiten = besluiten.filter(b => !existingTkIds.has(b.Id));
    console.log(`[INGEST] ${existingTkIds.size} votes already in DB, ${newBesluiten.length} new to process`);

    let successCount = 0;
    let errorCount = 0;
    let linkedToMotion = 0;
    let unlinked = 0;
    let hoofdelijkCount = 0;
    let handopstekenCount = 0;
    let voteRecordsCreated = 0;
    const startTime = Date.now();

    for (const besluit of newBesluiten) {
      try {
        const voteDate = extractVoteDate(besluit);
        const result = extractResult(besluit);
        const title = buildTitle(besluit);
        const stemmingen = besluit.Stemming || [];

        // Find related motion via in-memory cache
        let motionId: string | null = null;
        const zaakList = besluit.Zaak || [];
        
        // Strategy 1: Find a Zaak with Soort='Motie' directly
        const motieZaak = zaakList.find(z => z.Soort === 'Motie');
        if (motieZaak) {
          motionId = motionByTkId.get(motieZaak.Id) || null;
        }
        
        // Strategy 2: If no Motie-type Zaak found, try any Zaak
        if (!motionId && zaakList.length > 0) {
          for (const zaak of zaakList) {
            const found = motionByTkId.get(zaak.Id);
            if (found) { motionId = found; break; }
          }
        }

        // Track linking stats
        if (motionId) linkedToMotion++;
        else unlinked++;
        if (besluit.StemmingsSoort === 'Hoofdelijk') hoofdelijkCount++;
        else handopstekenCount++;

        // Upsert vote
        const vote = await prisma.vote.upsert({
          where: { tkId: besluit.Id },
          update: {
            motionId,
            date: voteDate,
            title,
            result,
            sourceUrl: `https://www.tweedekamer.nl/kamerstukken/stemmingen`,
            rawData: besluit as any,
          },
          create: {
            tkId: besluit.Id,
            motionId,
            date: voteDate,
            title,
            result,
            sourceUrl: `https://www.tweedekamer.nl/kamerstukken/stemmingen`,
            rawData: besluit as any,
          },
        });

        let totalFor = 0;
        let totalAgainst = 0;
        let totalAbstain = 0;

        // Collect VoteRecord data for batch writing (Hoofdelijk votes)
        const recordsToWrite: { mpId: string; voteValue: VoteValue; partyId: string | null }[] = [];

        // Process Stemming records (party-level or individual votes)
        for (const stemming of stemmingen) {
          if (stemming.Verwijderd) continue;

          const voteValue = mapVoteValue(stemming.Soort);

          if (besluit.StemmingsSoort === 'Hoofdelijk') {
            // For Hoofdelijk: count per individual (FractieGrootte = 1 or absent)
            if (voteValue === VoteValue.FOR) totalFor += 1;
            if (voteValue === VoteValue.AGAINST) totalAgainst += 1;
            if (voteValue === VoteValue.ABSTAIN) totalAbstain += 1;

            // Collect individual VoteRecord for batch upsert
            if (stemming.Persoon_Id) {
              const mpId = mpByTkId.get(stemming.Persoon_Id);
              if (mpId) {
                const partyId = stemming.Fractie_Id ? (partyByTkId.get(stemming.Fractie_Id) || null) : null;
                recordsToWrite.push({ mpId, voteValue, partyId });
              }
            }
          } else {
            // For Met handopsteken: count by FractieGrootte for party-level aggregation
            const count = stemming.FractieGrootte || 1;
            if (voteValue === VoteValue.FOR) totalFor += count;
            if (voteValue === VoteValue.AGAINST) totalAgainst += count;
            if (voteValue === VoteValue.ABSTAIN) totalAbstain += count;
          }
        }

        // Batch upsert VoteRecords using a transaction (much faster than sequential)
        if (recordsToWrite.length > 0) {
          await prisma.$transaction(
            recordsToWrite.map(r =>
              prisma.voteRecord.upsert({
                where: { voteId_mpId: { voteId: vote.id, mpId: r.mpId } },
                update: { voteValue: r.voteValue, partyIdSnapshot: r.partyId },
                create: { voteId: vote.id, mpId: r.mpId, voteValue: r.voteValue, partyIdSnapshot: r.partyId },
              })
            )
          );
          voteRecordsCreated += recordsToWrite.length;
        }

        // Update vote totals
        await prisma.vote.update({
          where: { id: vote.id },
          data: {
            totalFor,
            totalAgainst,
            totalAbstain,
          },
        });

        successCount++;
        if (successCount % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = (successCount / elapsed).toFixed(1);
          const eta = ((newBesluiten.length - successCount) / parseFloat(rate)).toFixed(0);
          console.log(`[INGEST] Progress: ${successCount}/${newBesluiten.length} (${(successCount/newBesluiten.length*100).toFixed(1)}%) | ${rate}/s | ETA: ${eta}s`);
        }
      } catch (err) {
        errorCount++;
        if (errorCount <= 10) {
          console.error(`[INGEST] ❌ Failed to process Besluit ${besluit.Id}:`, err);
        } else if (errorCount === 11) {
          console.error(`[INGEST] ❌ Suppressing further error details...`);
        }
      }
    }

    console.log(`\n[INGEST] ✅ Stemmingen ingest complete: ${successCount} succeeded, ${errorCount} failed (skipped ${existingTkIds.size} existing)`);
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[INGEST]    Total time: ${totalElapsed}s`);
    console.log(`[INGEST]    Linked to motion: ${linkedToMotion} | Unlinked: ${unlinked}`);
    console.log(`[INGEST]    Hoofdelijk: ${hoofdelijkCount} | Met handopsteken: ${handopstekenCount}`);
    console.log(`[INGEST]    Individual VoteRecords created/updated: ${voteRecordsCreated}`);
  } catch (error) {
    console.error('[INGEST] ❌ Stemmingen ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Ingest specifically Hoofdelijk (roll-call) votes using the dedicated API method.
 * These contain individual MP-level vote data (Persoon_Id on Stemming records).
 */
async function ingestHoofdelijk(limit?: number): Promise<void> {
  console.log('[INGEST] Starting dedicated Hoofdelijk (roll-call) ingest...');
  console.log('[INGEST] Pre-caching MPs and Parties for fast lookups...');

  try {
    // Pre-cache all MPs and Parties into memory maps for O(1) lookups
    // This avoids ~300 DB round-trips per vote (the main bottleneck)
    const allMps = await prisma.mp.findMany({ select: { id: true, tkId: true } });
    const mpByTkId = new Map(allMps.map(m => [m.tkId, m.id]));
    console.log(`[INGEST] Cached ${mpByTkId.size} MPs`);

    const allParties = await prisma.party.findMany({ select: { id: true, tkId: true } });
    const partyByTkId = new Map(allParties.map(p => [p.tkId, p.id]));
    console.log(`[INGEST] Cached ${partyByTkId.size} Parties`);

    // Also cache motions for linking
    const allMotions = await prisma.motion.findMany({ select: { id: true, tkId: true } });
    const motionByTkId = new Map(allMotions.map(m => [m.tkId, m.id]));
    console.log(`[INGEST] Cached ${motionByTkId.size} Motions`);

    const besluiten = await tkClient.getHoofdelijkBesluiten(limit);
    console.log(`[INGEST] Found ${besluiten.length} Hoofdelijk Besluiten`);

    let successCount = 0;
    let errorCount = 0;
    let linkedToMotion = 0;
    let voteRecordsCreated = 0;

    for (const besluit of besluiten) {
      try {
        const voteDate = extractVoteDate(besluit);
        const result = extractResult(besluit);
        const title = buildTitle(besluit);
        const stemmingen = besluit.Stemming || [];

        // Find related motion using in-memory cache
        let motionId: string | null = null;
        const zaakList = besluit.Zaak || [];
        const motieZaak = zaakList.find(z => z.Soort === 'Motie');
        if (motieZaak) {
          motionId = motionByTkId.get(motieZaak.Id) || null;
        }
        if (!motionId && zaakList.length > 0) {
          for (const zaak of zaakList) {
            const found = motionByTkId.get(zaak.Id);
            if (found) { motionId = found; break; }
          }
        }
        if (motionId) linkedToMotion++;

        // Upsert vote
        const vote = await prisma.vote.upsert({
          where: { tkId: besluit.Id },
          update: { motionId, date: voteDate, title, result, sourceUrl: 'https://www.tweedekamer.nl/kamerstukken/stemmingen', rawData: besluit as any },
          create: { tkId: besluit.Id, motionId, date: voteDate, title, result, sourceUrl: 'https://www.tweedekamer.nl/kamerstukken/stemmingen', rawData: besluit as any },
        });

        let totalFor = 0, totalAgainst = 0, totalAbstain = 0;

        // Collect all VoteRecord data first, then batch-write
        const recordsToWrite: { mpId: string; voteValue: VoteValue; partyId: string | null }[] = [];

        for (const stemming of stemmingen) {
          if (stemming.Verwijderd) continue;
          const voteValue = mapVoteValue(stemming.Soort);

          if (voteValue === VoteValue.FOR) totalFor += 1;
          if (voteValue === VoteValue.AGAINST) totalAgainst += 1;
          if (voteValue === VoteValue.ABSTAIN) totalAbstain += 1;

          if (stemming.Persoon_Id) {
            const mpId = mpByTkId.get(stemming.Persoon_Id);
            if (mpId) {
              const partyId = stemming.Fractie_Id ? (partyByTkId.get(stemming.Fractie_Id) || null) : null;
              recordsToWrite.push({ mpId, voteValue, partyId });
            }
          }
        }

        // Batch upsert VoteRecords using a transaction (much faster than sequential)
        if (recordsToWrite.length > 0) {
          await prisma.$transaction(
            recordsToWrite.map(r =>
              prisma.voteRecord.upsert({
                where: { voteId_mpId: { voteId: vote.id, mpId: r.mpId } },
                update: { voteValue: r.voteValue, partyIdSnapshot: r.partyId },
                create: { voteId: vote.id, mpId: r.mpId, voteValue: r.voteValue, partyIdSnapshot: r.partyId },
              })
            )
          );
          voteRecordsCreated += recordsToWrite.length;
        }

        await prisma.vote.update({
          where: { id: vote.id },
          data: { totalFor, totalAgainst, totalAbstain },
        });

        successCount++;
        const shortTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;
        console.log(`[INGEST] ✅ ${shortTitle} | ${result} (${totalFor}v/${totalAgainst}t) [Hoofdelijk] +${recordsToWrite.length} individual votes`);
      } catch (err) {
        errorCount++;
        console.error(`[INGEST] ❌ Failed: ${besluit.Id}:`, err);
      }
    }

    console.log(`\n[INGEST] ✅ Hoofdelijk ingest complete: ${successCount} succeeded, ${errorCount} failed`);
    console.log(`[INGEST]    Linked to motion: ${linkedToMotion}`);
    console.log(`[INGEST]    Individual VoteRecords created: ${voteRecordsCreated}`);
  } catch (error) {
    console.error('[INGEST] ❌ Hoofdelijk ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
