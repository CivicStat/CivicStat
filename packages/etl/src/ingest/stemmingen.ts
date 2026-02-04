/**
 * Ingest Stemmingen (Votes) from Tweede Kamer OData API
 */

import { PrismaClient, VoteValue } from '@ntp/db';
import { tkClient, type TKStemming, type TKStem } from '../clients/tk-odata.js';

const prisma = new PrismaClient();

function mapVoteValue(soort: string): VoteValue {
  switch (soort) {
    case 'Voor':
      return VoteValue.FOR;
    case 'Tegen':
      return VoteValue.AGAINST;
    case 'Niet deelgenomen':
      return VoteValue.ABSTAIN;
    case 'Afwezig':
      return VoteValue.ABSENT;
    default:
      console.warn(`Unknown vote type: ${soort}`);
      return VoteValue.ABSENT;
  }
}

export async function ingestStemmingen(limit?: number): Promise<void> {
  console.log('[INGEST] Starting Stemmingen ingest...');

  try {
    // Fetch recent stemmingen
    const filter = 'Verwijderd eq false and Vergaderdatum ne null';
    const stemmingen = limit
      ? await tkClient.getStemmingen(filter, limit)
      : await tkClient.getStemmingen(filter);

    console.log(`[INGEST] Found ${stemmingen.length} stemmingen`);

    for (const stemming of stemmingen) {
      // Save raw data
      await prisma.rawIngest.create({
        data: {
          source: 'TK_ODATA',
          resourceType: 'Stemming',
          resourceId: stemming.Id,
          payload: stemming as any,
        },
      });

      // Find related motion if BesluitId exists
      let motionId: string | null = null;
      if (stemming.BesluitId) {
        const motion = await prisma.motion.findUnique({
          where: { tkId: stemming.BesluitId },
        });
        motionId = motion?.id || null;
      }

      // Upsert vote
      const vote = await prisma.vote.upsert({
        where: { tkId: stemming.Id },
        update: {
          motionId,
          date: new Date(stemming.Vergaderdatum),
          title: stemming.BesluitTekst,
          result: stemming.Soort, // "Aangenomen" or "Verworpen"
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/stemmingen/detail?id=${stemming.Id}`,
          rawData: stemming as any,
        },
        create: {
          tkId: stemming.Id,
          motionId,
          date: new Date(stemming.Vergaderdatum),
          title: stemming.BesluitTekst,
          result: stemming.Soort,
          sourceUrl: `https://www.tweedekamer.nl/kamerstukken/stemmingen/detail?id=${stemming.Id}`,
          rawData: stemming as any,
        },
      });

      // Fetch individual votes (Stemmen)
      console.log(`[INGEST]   Fetching individual votes for ${stemming.Id.substring(0, 8)}...`);
      const stemmen = await tkClient.getStemmen(stemming.Id);

      let totalFor = 0;
      let totalAgainst = 0;
      let totalAbstain = 0;

      // Process each individual vote
      for (const stem of stemmen) {
        // Find MP
        const mp = await prisma.mp.findUnique({
          where: { tkId: stem.PersoonId },
        });

        if (!mp) {
          console.log(`[INGEST]   ⚠️  MP not found: ${stem.PersoonId}`);
          continue;
        }

        // Get party snapshot (party at time of vote)
        const party = await prisma.party.findUnique({
          where: { tkId: stem.FractieId },
        });

        if (!party) {
          console.log(`[INGEST]   ⚠️  Party not found: ${stem.FractieId}`);
          continue;
        }

        const voteValue = mapVoteValue(stem.Soort);

        // Count votes
        if (voteValue === VoteValue.FOR) totalFor++;
        if (voteValue === VoteValue.AGAINST) totalAgainst++;
        if (voteValue === VoteValue.ABSTAIN) totalAbstain++;

        // Upsert vote record
        await prisma.voteRecord.upsert({
          where: {
            voteId_mpId: {
              voteId: vote.id,
              mpId: mp.id,
            },
          },
          update: {
            voteValue,
            partyIdSnapshot: party.id,
          },
          create: {
            voteId: vote.id,
            mpId: mp.id,
            voteValue,
            partyIdSnapshot: party.id,
          },
        });
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

      console.log(
        `[INGEST] ✅ ${stemming.BesluitTekst.substring(0, 60)}... (${totalFor} voor, ${totalAgainst} tegen, ${totalAbstain} niet deelgenomen)`
      );
    }

    console.log('[INGEST] ✅ Stemmingen ingest complete');
  } catch (error) {
    console.error('[INGEST] ❌ Stemmingen ingest failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
