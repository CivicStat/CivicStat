/**
 * investigate-municipal-votes.ts
 *
 * Audits existing municipal vote data to understand what we have
 * and what we're missing for per-party vote records.
 *
 * Usage:
 *   npx tsx --env-file=.env src/scripts/investigate-municipal-votes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface VoteBreakdown {
  result: string;
  method: string;
  partiesAgainst: string[];
  partiesFor: string[];
  rawText: string;
}

interface VoteWithBreakdown {
  id: string;
  tkId: string;
  title: string;
  result: string;
  totalFor: number;
  totalAgainst: number;
  rawData: { voteBreakdown?: VoteBreakdown } | null;
  parliamentId: string | null;
}

async function investigate() {
  console.log("🔍 Municipal Vote Data Audit\n");
  console.log("═".repeat(60));

  // Get both municipal parliaments
  const parliaments = await prisma.parliament.findMany({
    where: { slug: { in: ["amsterdam", "den-haag"] } },
    select: { id: true, slug: true, name: true, seats: true },
  });

  if (parliaments.length === 0) {
    console.log("❌ No municipal parliaments found");
    return;
  }

  for (const parliament of parliaments) {
    console.log(`\n🏛  ${parliament.name} (${parliament.seats} seats)`);
    console.log("─".repeat(60));

    // Get all votes for this parliament
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
        parliamentId: true,
      },
    }) as VoteWithBreakdown[];

    console.log(`  Total votes: ${votes.length}`);

    // Check existing VoteRecords
    const existingRecords = await prisma.voteRecord.count({
      where: { vote: { parliamentId: parliament.id } },
    });
    console.log(`  Existing VoteRecords: ${existingRecords}`);

    // Count by method
    const byMethod: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    let hasBreakdown = 0;
    let noBreakdown = 0;
    let hasPartiesAgainst = 0;
    let hasPartiesFor = 0;
    let hasAnyPartyData = 0;
    const unknownSamples: { title: string; rawText: string }[] = [];
    const allPartiesFound = new Set<string>();

    for (const vote of votes) {
      const breakdown = (vote.rawData as any)?.voteBreakdown as VoteBreakdown | undefined;
      if (!breakdown) {
        noBreakdown++;
        continue;
      }
      hasBreakdown++;

      const method = breakdown.method || "missing";
      byMethod[method] = (byMethod[method] || 0) + 1;

      const result = breakdown.result || "missing";
      byResult[result] = (byResult[result] || 0) + 1;

      if (breakdown.partiesAgainst?.length > 0) {
        hasPartiesAgainst++;
        for (const p of breakdown.partiesAgainst) allPartiesFound.add(p);
      }
      if (breakdown.partiesFor?.length > 0) {
        hasPartiesFor++;
        for (const p of breakdown.partiesFor) allPartiesFound.add(p);
      }
      if ((breakdown.partiesAgainst?.length || 0) > 0 || (breakdown.partiesFor?.length || 0) > 0) {
        hasAnyPartyData++;
      }

      // Sample unknown methods
      if (method === "unknown" && unknownSamples.length < 25) {
        unknownSamples.push({
          title: vote.title.substring(0, 80),
          rawText: breakdown.rawText?.substring(0, 200) || "(empty)",
        });
      }
    }

    console.log(`\n  📊 Breakdown availability:`);
    console.log(`    Has voteBreakdown: ${hasBreakdown}`);
    console.log(`    No voteBreakdown:  ${noBreakdown}`);

    console.log(`\n  📊 By method:`);
    for (const [method, count] of Object.entries(byMethod).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / hasBreakdown) * 100).toFixed(1);
      console.log(`    ${method.padEnd(15)} ${String(count).padStart(4)} (${pct}%)`);
    }

    console.log(`\n  📊 By result:`);
    for (const [result, count] of Object.entries(byResult).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / hasBreakdown) * 100).toFixed(1);
      console.log(`    ${result.padEnd(15)} ${String(count).padStart(4)} (${pct}%)`);
    }

    console.log(`\n  📊 Party data availability:`);
    console.log(`    Has partiesAgainst: ${hasPartiesAgainst}`);
    console.log(`    Has partiesFor:     ${hasPartiesFor}`);
    console.log(`    Has any party data: ${hasAnyPartyData}`);

    // Compute actionable stats
    const unanimous = (byMethod["unanimous"] || 0) + (byMethod["no_vote"] || 0);
    const withPartyData = hasAnyPartyData;
    const actionable = unanimous + withPartyData;
    const ingetrokken = byResult["ingetrokken"] || 0;
    const unknown = byMethod["unknown"] || 0;
    console.log(`\n  ✅ Actionable for VoteRecord creation:`);
    console.log(`    Unanimous/no_vote (all parties VOOR): ${unanimous}`);
    console.log(`    with_against (party names parsed):     ${withPartyData}`);
    console.log(`    Total actionable:                      ${actionable}/${hasBreakdown}`);
    console.log(`    Ingetrokken (skip):                    ${ingetrokken}`);
    console.log(`    Unknown (need better parsing):         ${unknown}`);

    // Show parties found in text
    if (allPartiesFound.size > 0) {
      console.log(`\n  📊 Party names found in vote text (${allPartiesFound.size}):`);
      for (const p of [...allPartiesFound].sort()) {
        console.log(`    - ${p}`);
      }
    }

    // Show DB parties for comparison
    const dbParties = await prisma.party.findMany({
      where: { parliamentId: parliament.id },
      select: { abbreviation: true, name: true, id: true },
      orderBy: { abbreviation: "asc" },
    });
    console.log(`\n  📊 DB parties (${dbParties.length}):`);
    for (const p of dbParties) {
      console.log(`    - ${p.abbreviation} (${p.name})`);
    }

    // Show unknown samples
    if (unknownSamples.length > 0) {
      console.log(`\n  📊 Unknown method samples (${unknownSamples.length}):`);
      for (let i = 0; i < unknownSamples.length; i++) {
        console.log(`    [${i + 1}] "${unknownSamples[i].rawText}"`);
      }
    }

    // Check rawData for structured vote info we might be ignoring
    console.log(`\n  📊 Checking raw attributes for structured vote data...`);
    let foundStemmingAttrs = 0;
    const stemmingAttrLabels = new Set<string>();
    const sampleVotes = votes.slice(0, 50);
    for (const vote of sampleVotes) {
      const rawAttrs = vote.rawData as Record<string, any> | null;
      if (!rawAttrs) continue;
      // Check for any key that might contain vote data beyond voteBreakdown
      for (const key of Object.keys(rawAttrs)) {
        const lk = key.toLowerCase();
        if (lk.includes("stemm") || lk.includes("uitslag") || lk.includes("stemverhouding") || lk.includes("stemresultaat")) {
          if (key !== "voteBreakdown") {
            foundStemmingAttrs++;
            stemmingAttrLabels.add(key);
          }
        }
      }
    }
    if (foundStemmingAttrs > 0) {
      console.log(`    Found ${foundStemmingAttrs} raw attributes with vote-related keys:`);
      for (const label of stemmingAttrLabels) {
        console.log(`      - ${label}`);
      }
    } else {
      console.log(`    No additional structured vote data found in rawData`);
    }

    // Check motions raw data for vote attributes
    console.log(`\n  📊 Checking motion rawData for structured vote attributes...`);
    const sampleMotions = await prisma.motion.findMany({
      where: { parliamentId: parliament.id },
      select: { rawData: true },
      take: 30,
    });
    const motionVoteLabels = new Set<string>();
    for (const m of sampleMotions) {
      const raw = m.rawData as Record<string, any> | null;
      if (!raw) continue;
      for (const key of Object.keys(raw)) {
        const lk = key.toLowerCase();
        if (lk.includes("stemm") || lk.includes("uitslag") || lk.includes("stemverhouding") || lk.includes("stemresultaat") || lk.includes("vote") || lk.includes("fractie")) {
          motionVoteLabels.add(key);
        }
      }
    }
    if (motionVoteLabels.size > 0) {
      console.log(`    Found vote-related raw attribute labels in motions:`);
      for (const label of motionVoteLabels) {
        // Show a sample value
        const sample = sampleMotions.find(m => (m.rawData as any)?.[label]);
        const val = sample ? JSON.stringify((sample.rawData as any)[label]).substring(0, 120) : "";
        console.log(`      - ${label}: ${val}`);
      }
    } else {
      console.log(`    No additional structured vote data in motion rawData`);
    }

    // MPs per party
    console.log(`\n  📊 MPs (raadsleden) per party:`);
    const mpsPerParty = await prisma.mp.groupBy({
      by: ["partyId"],
      where: { parliamentId: parliament.id },
      _count: true,
    });
    const partyMap = new Map(dbParties.map(p => [p.id, p.abbreviation]));
    for (const g of mpsPerParty.sort((a, b) => b._count - a._count)) {
      console.log(`    ${(partyMap.get(g.partyId) || "?").padEnd(25)} ${g._count} MPs`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("✅ Audit complete\n");
}

investigate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
