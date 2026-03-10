/**
 * seed-municipal-vote-records.ts
 *
 * Creates per-party VoteRecord entries for municipal votes,
 * enabling the scorecard computation pipeline.
 *
 * Logic per vote:
 *   - unanimous/no_vote + aangenomen → all parties VOOR
 *   - with_against + aangenomen → partiesAgainst → TEGEN, rest → VOOR
 *   - with_against + verworpen → partiesFor → VOOR, rest → TEGEN
 *   - unknown / ingetrokken → skip
 *
 * VoteRecord requires an mpId — we pick one representative MP per party
 * (following the TK "met handopsteken" pattern from stemmingen.ts).
 *
 * Usage:
 *   npx tsx --env-file=.env src/index.ts seed-vote-records --parliament amsterdam
 *   npx tsx --env-file=.env src/index.ts seed-vote-records --parliament den-haag
 *   npx tsx --env-file=.env src/index.ts seed-vote-records --parliament amsterdam --dry-run
 *   npx tsx --env-file=.env src/index.ts seed-vote-records --parliament amsterdam --force
 */

import { PrismaClient } from "@prisma/client";
import type { VoteValue as VoteValueEnum } from "@prisma/client";

const VoteValue = { FOR: 'FOR', AGAINST: 'AGAINST', ABSTAIN: 'ABSTAIN', ABSENT: 'ABSENT' } as const satisfies Record<string, VoteValueEnum>;
import { NotubizClient, type ParsedVoteBreakdown } from "../municipal/notubiz-client.js";

const prisma = new PrismaClient();

// ── Party name alias map ────────────────────────────────────
// Maps NotuBiz party names (as found in Toelichting text) to DB abbreviations.
// Case-insensitive matching is done at lookup time.

const PARTY_ALIASES: Record<string, string[]> = {
  // Amsterdam
  "GroenLinks": ["GroenLinks", "GL"],
  "PvdA": ["PvdA", "Partij van de Arbeid"],
  "D66": ["D66"],
  "VVD": ["VVD"],
  "SP": ["SP"],
  "CDA": ["CDA"],
  "DENK": ["DENK", "Denk"],
  "Partij voor de Dieren": ["Partij voor de Dieren", "PvdD"],
  "JA21": ["JA21", "Ja21"],
  "FVD": ["FVD", "Forum voor Democratie"],
  "VOLT": ["VOLT", "Volt"],
  "De Vonk": ["De Vonk", "Vonk"],
  "Lijst Kabamba": ["Lijst Kabamba"],
  "Partij voor Morgen": ["Partij voor Morgen"],
  "BIJ1": ["BIJ1", "Bij1"],
  // Den Haag
  "Hart voor Den Haag": ["Hart voor Den Haag", "HvDH"],
  "Haagse Stadspartij": ["Haagse Stadspartij", "HSP"],
  "PVV": ["PVV"],
  "ChristenUnie-SGP": ["ChristenUnie-SGP", "CU-SGP", "ChristenUnie/SGP"],
  "Groep van den Goorbergh": ["Groep van den Goorbergh"],
};

// ── Types ───────────────────────────────────────────────────

interface PartyInfo {
  id: string;
  abbreviation: string;
  name: string;
  seats: number;
  representativeMpId: string | null; // One MP to use for VoteRecord
}

// ── Main ────────────────────────────────────────────────────

export async function seedMunicipalVoteRecords(opts: {
  parliament: string;
  dryRun?: boolean;
  force?: boolean;
}) {
  const { parliament: slug, dryRun = false, force = false } = opts;

  console.log(`\n🗳️  Seeding municipal VoteRecords for ${slug}`);
  if (dryRun) console.log("   (DRY RUN — no database writes)\n");
  else console.log("");

  // 1. Resolve parliament
  const parliament = await prisma.parliament.findUnique({
    where: { slug },
    select: { id: true, name: true, seats: true },
  });
  if (!parliament) {
    throw new Error(`Parliament not found: ${slug}`);
  }
  console.log(`🏛  ${parliament.name} (${parliament.seats} seats)\n`);

  // 2. Check existing VoteRecords
  const existingCount = await prisma.voteRecord.count({
    where: { vote: { parliamentId: parliament.id } },
  });
  if (existingCount > 0 && !force) {
    console.log(`⚠️  ${existingCount} VoteRecords already exist for ${slug}.`);
    console.log("   Use --force to delete and recreate.");
    return;
  }
  if (existingCount > 0 && force) {
    console.log(`🗑  Deleting ${existingCount} existing VoteRecords...`);
    if (!dryRun) {
      await prisma.voteRecord.deleteMany({
        where: { vote: { parliamentId: parliament.id } },
      });
    }
  }

  // 3. Load all parties for this parliament with representative MPs
  const parties = await prisma.party.findMany({
    where: { parliamentId: parliament.id },
    select: { id: true, abbreviation: true, name: true, seats: true },
  });

  // Pre-load one MP per party for representative VoteRecords
  const allMps = await prisma.mp.findMany({
    where: { parliamentId: parliament.id },
    select: { id: true, partyId: true },
  });
  const mpByParty = new Map<string, string>();
  for (const mp of allMps) {
    if (!mpByParty.has(mp.partyId)) {
      mpByParty.set(mp.partyId, mp.id);
    }
  }

  const partyInfos: PartyInfo[] = parties.map(p => ({
    id: p.id,
    abbreviation: p.abbreviation,
    name: p.name,
    seats: p.seats || 1,
    representativeMpId: mpByParty.get(p.id) || null,
  }));

  // Build lookup maps
  const partyByName = buildPartyLookup(partyInfos);
  const allPartyIds = new Set(partyInfos.map(p => p.id));

  // Create placeholder MPs for parties without any representatives
  const partiesWithoutMps = partyInfos.filter(p => !p.representativeMpId);
  if (partiesWithoutMps.length > 0 && !dryRun) {
    console.log(`📝 Creating placeholder MPs for ${partiesWithoutMps.length} parties without representatives...`);
    for (const party of partiesWithoutMps) {
      const placeholderTkId = `NB-PLACEHOLDER-${party.abbreviation}`;
      const existing = await prisma.mp.findFirst({
        where: { tkId: placeholderTkId },
      });
      if (existing) {
        party.representativeMpId = existing.id;
        console.log(`   Reusing existing placeholder: ${party.abbreviation}`);
      } else {
        const mp = await prisma.mp.create({
          data: {
            tkId: placeholderTkId,
            name: `${party.abbreviation} (fractie)`,
            surname: party.abbreviation,
            partyId: party.id,
            startDate: new Date("2022-03-01"),
            parliamentId: parliament.id,
            sourceSystem: "notubiz-placeholder",
          },
        });
        party.representativeMpId = mp.id;
        console.log(`   Created placeholder MP: ${party.abbreviation}`);
      }
    }
  }

  console.log(`\n📊 Parties loaded: ${partyInfos.length}`);
  const partiesWithMps = partyInfos.filter(p => p.representativeMpId);
  const stillWithoutMps = partyInfos.filter(p => !p.representativeMpId);
  console.log(`   With representative MP: ${partiesWithMps.length}`);
  if (stillWithoutMps.length > 0) {
    console.log(`   ⚠️  Without MP (will be skipped): ${stillWithoutMps.map(p => p.abbreviation).join(", ")}`);
  }

  // 4. Load all votes for this parliament
  const votes = await prisma.vote.findMany({
    where: { parliamentId: parliament.id },
    select: {
      id: true,
      tkId: true,
      title: true,
      result: true,
      totalFor: true,
      totalAgainst: true,
      rawData: true,
    },
  });
  console.log(`🗳️  Votes loaded: ${votes.length}\n`);

  // Re-parse breakdowns with improved parser
  const notubizClient = new NotubizClient(0); // orgId unused for parsing

  // 5. Process each vote
  let totalRecords = 0;
  let skippedNoBreakdown = 0;
  let skippedUnknown = 0;
  let skippedIngetrokken = 0;
  let skippedNoResult = 0;
  let processedVotes = 0;
  let unanimousVotes = 0;
  let withAgainstVotes = 0;
  const unmatchedParties = new Map<string, number>();
  const errors: string[] = [];

  for (const vote of votes) {
    const rawData = vote.rawData as { voteBreakdown?: ParsedVoteBreakdown } | null;
    const oldBreakdown = rawData?.voteBreakdown;

    if (!oldBreakdown) {
      skippedNoBreakdown++;
      continue;
    }

    // Re-parse with improved parser (handles &nbsp;, singular "stem", bare results)
    const breakdown = notubizClient.parseVoteBreakdown(
      oldBreakdown.result || "",
      oldBreakdown.rawText || "",
    );

    // Skip non-actionable
    if (breakdown.result === "ingetrokken") {
      skippedIngetrokken++;
      continue;
    }
    if (breakdown.result === "unknown") {
      skippedNoResult++;
      continue;
    }
    if (breakdown.method === "unknown") {
      skippedUnknown++;
      continue;
    }

    // Determine party votes
    const partyVotes = new Map<string, VoteValueEnum>(); // partyId → vote

    if (breakdown.method === "unanimous" || breakdown.method === "no_vote") {
      // All parties voted VOOR (if aangenomen) or all TEGEN (if verworpen)
      unanimousVotes++;
      const defaultVote = breakdown.result === "aangenomen" ? VoteValue.FOR : VoteValue.AGAINST;
      for (const party of partyInfos) {
        if (party.representativeMpId) {
          partyVotes.set(party.id, defaultVote);
        }
      }
    } else if (breakdown.method === "with_against") {
      withAgainstVotes++;

      if (breakdown.result === "aangenomen") {
        // Parties against are TEGEN, all others VOOR
        const tegenPartyIds = new Set<string>();
        for (const partyName of breakdown.partiesAgainst) {
          const party = lookupParty(partyName, partyByName);
          if (party && party.representativeMpId) {
            tegenPartyIds.add(party.id);
            partyVotes.set(party.id, VoteValue.AGAINST);
          } else if (!party) {
            unmatchedParties.set(partyName, (unmatchedParties.get(partyName) || 0) + 1);
          }
        }
        // All others VOOR
        for (const party of partyInfos) {
          if (party.representativeMpId && !tegenPartyIds.has(party.id)) {
            partyVotes.set(party.id, VoteValue.FOR);
          }
        }

        // If partiesFor was also parsed (rare), override
        for (const partyName of breakdown.partiesFor) {
          const party = lookupParty(partyName, partyByName);
          if (party && party.representativeMpId) {
            partyVotes.set(party.id, VoteValue.FOR);
          }
        }
      } else if (breakdown.result === "verworpen") {
        // Parties for are VOOR, all others TEGEN
        const voorPartyIds = new Set<string>();
        for (const partyName of breakdown.partiesFor) {
          const party = lookupParty(partyName, partyByName);
          if (party && party.representativeMpId) {
            voorPartyIds.add(party.id);
            partyVotes.set(party.id, VoteValue.FOR);
          } else if (!party) {
            unmatchedParties.set(partyName, (unmatchedParties.get(partyName) || 0) + 1);
          }
        }
        // All others TEGEN
        for (const party of partyInfos) {
          if (party.representativeMpId && !voorPartyIds.has(party.id)) {
            partyVotes.set(party.id, VoteValue.AGAINST);
          }
        }

        // If partiesAgainst was also parsed, override
        for (const partyName of breakdown.partiesAgainst) {
          const party = lookupParty(partyName, partyByName);
          if (party && party.representativeMpId) {
            partyVotes.set(party.id, VoteValue.AGAINST);
          }
        }
      }
    }

    if (partyVotes.size === 0) continue;

    // Create VoteRecords
    processedVotes++;
    const records = [...partyVotes.entries()]
      .map(([partyId, voteValue]) => {
        const party = partyInfos.find(p => p.id === partyId);
        if (!party?.representativeMpId) return null;
        return {
          voteId: vote.id,
          mpId: party.representativeMpId,
          voteValue,
          partyIdSnapshot: partyId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (!dryRun && records.length > 0) {
      try {
        await prisma.$transaction(
          records.map(r =>
            prisma.voteRecord.upsert({
              where: { voteId_mpId: { voteId: r.voteId, mpId: r.mpId } },
              update: { voteValue: r.voteValue, partyIdSnapshot: r.partyIdSnapshot },
              create: r,
            })
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (errors.length < 10) errors.push(`Vote ${vote.tkId}: ${msg}`);
        continue;
      }
    }

    // Update vote totals based on pre-cached seat counts
    let totalFor = 0;
    let totalAgainst = 0;
    for (const [partyId, voteVal] of partyVotes) {
      const party = partyInfos.find(p => p.id === partyId);
      const seats = party?.seats || 1;
      if (voteVal === VoteValue.FOR) totalFor += seats;
      else if (voteVal === VoteValue.AGAINST) totalAgainst += seats;
    }
    if (!dryRun) {
      await prisma.vote.update({
        where: { id: vote.id },
        data: { totalFor, totalAgainst },
      });
    }

    totalRecords += records.length;

    if (processedVotes % 100 === 0) {
      console.log(`  Progress: ${processedVotes} votes processed, ${totalRecords} records created`);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log(`✅ VoteRecord seeding complete for ${parliament.name}`);
  console.log(`   Votes processed:        ${processedVotes}`);
  console.log(`   VoteRecords created:     ${totalRecords}`);
  console.log(`   Unanimous/no_vote:       ${unanimousVotes}`);
  console.log(`   With party breakdown:    ${withAgainstVotes}`);
  console.log(`   Skipped (unknown):       ${skippedUnknown}`);
  console.log(`   Skipped (ingetrokken):   ${skippedIngetrokken}`);
  console.log(`   Skipped (no result):     ${skippedNoResult}`);
  console.log(`   Skipped (no breakdown):  ${skippedNoBreakdown}`);

  if (unmatchedParties.size > 0) {
    console.log(`\n⚠️  Unmatched party names (${unmatchedParties.size}):`);
    for (const [name, count] of [...unmatchedParties.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     "${name}" (${count}×)`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    for (const e of errors) {
      console.log(`     ${e}`);
    }
  }

  console.log("");
}

// ── Party name lookup ─────────────────────────────────────

function buildPartyLookup(parties: PartyInfo[]): Map<string, PartyInfo> {
  const map = new Map<string, PartyInfo>();

  for (const party of parties) {
    // Add by abbreviation (case insensitive)
    map.set(party.abbreviation.toLowerCase(), party);
    // Add by full name
    map.set(party.name.toLowerCase(), party);

    // Add known aliases
    for (const [dbAbbr, aliases] of Object.entries(PARTY_ALIASES)) {
      if (
        dbAbbr.toLowerCase() === party.abbreviation.toLowerCase() ||
        dbAbbr.toLowerCase() === party.name.toLowerCase()
      ) {
        for (const alias of aliases) {
          map.set(alias.toLowerCase(), party);
        }
      }
    }
  }

  return map;
}

function lookupParty(
  name: string,
  partyByName: Map<string, PartyInfo>,
): PartyInfo | null {
  const clean = name.trim().toLowerCase();
  if (!clean || clean.length < 2) return null;

  // Direct lookup
  const direct = partyByName.get(clean);
  if (direct) return direct;

  // Try without trailing punctuation
  const stripped = clean.replace(/[.,;:!?]+$/, "").trim();
  const strippedMatch = partyByName.get(stripped);
  if (strippedMatch) return strippedMatch;

  // Try partial match for "GroenLinks Partij voor de Dieren" → should match "GroenLinks"
  // but only if no direct match
  for (const [key, party] of partyByName) {
    if (clean.startsWith(key + " ") || clean === key) {
      return party;
    }
  }

  return null;
}
