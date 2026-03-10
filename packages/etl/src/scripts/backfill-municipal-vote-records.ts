/**
 * Backfill VoteRecords for municipal votes from NotuBiz voteBreakdown data.
 *
 * The NotuBiz sync stores per-party vote breakdown in Vote.rawData.voteBreakdown
 * but doesn't create VoteRecord rows. The MCS scoring engine needs VoteRecords
 * (which are per-MP) to compute scores.
 *
 * Strategy: For each party mentioned in the breakdown, pick one representative
 * raadslid (the first one found) and create a VoteRecord for that raadslid.
 * The MCS engine looks at partyIdSnapshot, so having one record per party is enough.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-municipal-vote-records.ts --parliament amsterdam
 *   npx tsx src/scripts/backfill-municipal-vote-records.ts --parliament den-haag
 *   npx tsx src/scripts/backfill-municipal-vote-records.ts  # all municipal
 */

import { PrismaClient } from "@prisma/client";
import type { VoteValue as VoteValueEnum } from "@prisma/client";

const VoteValue = { FOR: 'FOR', AGAINST: 'AGAINST', ABSTAIN: 'ABSTAIN', ABSENT: 'ABSENT' } as const satisfies Record<string, VoteValueEnum>;

const prisma = new PrismaClient();

interface VoteBreakdown {
  result: string;
  method: string;
  partiesFor: string[];
  partiesAgainst: string[];
  rawText: string;
}

async function backfillVoteRecords(parliamentSlug?: string) {
  const where: any = { type: "MUNICIPAL" };
  if (parliamentSlug) where.slug = parliamentSlug;

  const parliaments = await prisma.parliament.findMany({ where });
  if (parliaments.length === 0) {
    console.error("No municipal parliaments found.");
    return;
  }

  for (const parliament of parliaments) {
    console.log(`\n🏛️  Processing ${parliament.shortName || parliament.name} (${parliament.slug})`);

    // Load all parties + one representative MP per party
    const parties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      include: {
        mps: { take: 1, select: { id: true, name: true } },
      },
    });

    // Build lookup: lowercase party name/abbr → { partyId, repMpId }
    const partyLookup = new Map<string, { partyId: string; mpId: string }>();
    let partiesWithoutMP = 0;

    for (const p of parties) {
      if (p.mps.length === 0) {
        partiesWithoutMP++;
        continue;
      }
      const entry = { partyId: p.id, mpId: p.mps[0].id };
      partyLookup.set(p.abbreviation.toLowerCase(), entry);
      partyLookup.set(p.name.toLowerCase(), entry);
      // Also try common variations
      const cleanName = p.abbreviation.replace(/[-\s]/g, "").toLowerCase();
      partyLookup.set(cleanName, entry);
    }

    console.log(`  Loaded ${parties.length} parties (${partiesWithoutMP} without MPs)`);
    console.log(`  Lookup entries: ${partyLookup.size}`);

    // Find all votes for this parliament
    const votes = await prisma.vote.findMany({
      where: { motion: { parliamentId: parliament.id } },
      select: {
        id: true,
        tkId: true,
        rawData: true,
        motionId: true,
      },
    });

    console.log(`  Found ${votes.length} votes to process`);

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalNoBreakdown = 0;
    let unmatchedPartyNames = new Set<string>();

    for (const vote of votes) {
      const rawData = vote.rawData as any;
      const breakdown: VoteBreakdown | undefined = rawData?.voteBreakdown;

      if (!breakdown || (!breakdown.partiesFor?.length && !breakdown.partiesAgainst?.length)) {
        totalNoBreakdown++;
        continue;
      }

      // Check if VoteRecords already exist for this vote
      const existingCount = await prisma.voteRecord.count({
        where: { voteId: vote.id },
      });

      if (existingCount > 0) {
        totalSkipped++;
        continue;
      }

      const records: { voteId: string; mpId: string; partyIdSnapshot: string; voteValue: VoteValueEnum }[] = [];

      // Process FOR votes
      for (const partyName of breakdown.partiesFor) {
        const entry = findParty(partyLookup, partyName);
        if (!entry) {
          unmatchedPartyNames.add(partyName);
          continue;
        }
        records.push({
          voteId: vote.id,
          mpId: entry.mpId,
          partyIdSnapshot: entry.partyId,
          voteValue: "FOR",
        });
      }

      // Process AGAINST votes
      for (const partyName of breakdown.partiesAgainst) {
        const entry = findParty(partyLookup, partyName);
        if (!entry) {
          unmatchedPartyNames.add(partyName);
          continue;
        }
        records.push({
          voteId: vote.id,
          mpId: entry.mpId,
          partyIdSnapshot: entry.partyId,
          voteValue: "AGAINST",
        });
      }

      // Deduplicate (in case same party appears in both for AND against by mistake)
      const seen = new Set<string>();
      const dedupedRecords = records.filter(r => {
        const key = `${r.voteId}-${r.partyIdSnapshot}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Bulk insert
      if (dedupedRecords.length > 0) {
        // Use individual creates due to @@unique constraint on [voteId, mpId]
        // Multiple parties may share same representative MP in edge cases, so skip duplicates
        for (const rec of dedupedRecords) {
          try {
            await prisma.voteRecord.create({ data: rec });
            totalCreated++;
          } catch (err: any) {
            if (err.code === "P2002") {
              // Unique constraint violation — skip
              continue;
            }
            throw err;
          }
        }
      }
    }

    console.log(`  ✅ Created ${totalCreated} VoteRecords`);
    console.log(`  ⏭️  Skipped ${totalSkipped} votes (already have records)`);
    console.log(`  ⚠️  ${totalNoBreakdown} votes without breakdown data`);
    if (unmatchedPartyNames.size > 0) {
      console.log(`  ❌ Unmatched party names: ${[...unmatchedPartyNames].join(", ")}`);
    }
  }

  await prisma.$disconnect();
  console.log("\n✅ Backfill complete.");
}

function findParty(
  lookup: Map<string, { partyId: string; mpId: string }>,
  name: string
): { partyId: string; mpId: string } | undefined {
  const lower = name.toLowerCase().trim();
  
  // Direct match
  let entry = lookup.get(lower);
  if (entry) return entry;

  // Try without dashes/spaces
  const clean = lower.replace(/[-\s]/g, "");
  entry = lookup.get(clean);
  if (entry) return entry;

  // Try partial match (e.g., "Partij voor de Dieren" → "PvdD")
  for (const [key, val] of lookup) {
    if (lower.includes(key) || key.includes(lower)) {
      return val;
    }
  }

  return undefined;
}

// CLI
const args = process.argv.slice(2);
const parlArg = args.includes("--parliament") ? args[args.indexOf("--parliament") + 1] : undefined;

backfillVoteRecords(parlArg).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
