/**
 * NotuBiz Municipal Sync
 *
 * Syncs moties, raadsleden, and parties from NotuBiz (Amsterdam, Den Haag)
 * into the CivicStat database.
 *
 * Usage:
 *   npx tsx src/municipal/notubiz-sync.ts --parliament amsterdam
 *   npx tsx src/municipal/notubiz-sync.ts --parliament den-haag --from 2022-01-01
 */

import { PrismaClient } from "@prisma/client";
import { NotubizClient, ParsedMotie, ParsedVoteBreakdown } from "./notubiz-client.js";

const prisma = new PrismaClient();

const SLEEP_MS = 200; // Be polite to the API

// ── CLI args ───────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let parliamentSlug = "";
  let dateFrom = "2022-03-01"; // Default: start of current municipal term
  let dateTo = new Date().toISOString().split("T")[0]; // Today

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--parliament" && args[i + 1]) parliamentSlug = args[++i];
    if (args[i] === "--from" && args[i + 1]) dateFrom = args[++i];
    if (args[i] === "--to" && args[i + 1]) dateTo = args[++i];
  }

  if (!parliamentSlug) {
    console.error("Usage: npx tsx src/municipal/notubiz-sync.ts --parliament <slug>");
    console.error("  Slugs: amsterdam, den-haag");
    process.exit(1);
  }

  return { parliamentSlug, dateFrom, dateTo };
}

// ── Exported function for CLI integration ─────────────────

export interface SyncNotubizParams {
  parliament: string;
  from?: string;
  to?: string;
}

export async function runNotubizSync(params: SyncNotubizParams) {
  return syncNotubizImpl(
    params.parliament,
    params.from ?? "2022-03-01",
    params.to ?? new Date().toISOString().split("T")[0],
  );
}

// ── Main sync logic ────────────────────────────────────────

async function syncNotubiz() {
  const { parliamentSlug, dateFrom, dateTo } = parseArgs();
  return syncNotubizImpl(parliamentSlug, dateFrom, dateTo);
}

async function syncNotubizImpl(parliamentSlug: string, dateFrom: string, dateTo: string) {

  // Load parliament config
  const parliament = await prisma.parliament.findUnique({
    where: { slug: parliamentSlug },
  });
  if (!parliament) {
    console.error(`Parliament "${parliamentSlug}" not found in database.`);
    process.exit(1);
  }

  const config = parliament.dataSourceConfig as { type: string; orgId?: number } | null;
  if (!config || config.type !== "notubiz" || !config.orgId) {
    console.error(`Parliament "${parliamentSlug}" is not configured for NotuBiz. Config: ${JSON.stringify(config)}`);
    process.exit(1);
  }

  const client = new NotubizClient(config.orgId);
  const from = new Date(dateFrom);
  const to = new Date(dateTo + "T23:59:59Z");

  console.log(`\n🏛️  Syncing ${parliament.shortName} from NotuBiz (orgId=${config.orgId})`);
  console.log(`📅  Date range: ${dateFrom} → ${dateTo}\n`);

  // Step 1: Find all Raad meetings
  console.log("Step 1: Fetching Raad meetings...");
  const raadMeetings = await client.getRaadMeetings(from, to);
  console.log(`  Found ${raadMeetings.length} Raad meetings`);

  let totalMoties = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const partyNames = new Set<string>();
  const personNames = new Map<number, { name: string; partyName: string }>();

  // Step 2: For each meeting, fetch full details and extract moties
  for (const event of raadMeetings) {
    const title = client.getEventTitle(event);
    const meetingDate = event.plannings?.[0]?.start_date || "?";
    console.log(`\n📋 Meeting: ${title} (${meetingDate})`);

    await sleep(SLEEP_MS);
    let meeting;
    try {
      meeting = await client.getMeeting(event.id);
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("401") || msg.includes("No rights")) {
        console.log(`  ⏭️  Skipping restricted meeting (401 — no access)`);
        continue;
      }
      // Re-throw non-auth errors
      throw err;
    }
    const moduleItemIds = client.extractModuleItemIds(meeting);
    console.log(`  Agenda items: ${meeting.agenda_items?.length || 0}, module items: ${moduleItemIds.length}`);

    // Step 3: Fetch each module item and parse moties
    for (const itemId of moduleItemIds) {
      await sleep(SLEEP_MS);
      try {
        const raw = await client.getModuleItem(itemId);
        const motie = client.parseModuleItem(raw, itemId);

        if (!motie) {
          totalSkipped++;
          continue;
        }

        totalMoties++;

        // Track parties and people
        for (const p of motie.parties) {
          partyNames.add(p.name);
        }
        for (const s of motie.submitters) {
          const partyName = motie.parties[0]?.name || "Onbekend";
          personNames.set(s.personId, { name: s.name, partyName });
        }

        // Upsert the motie into the database
        const result = await upsertMotie(motie, parliament.id, client);
        if (result === "created") totalNew++;
        else if (result === "updated") totalUpdated++;
      } catch (err) {
        console.error(`  ❌ Error fetching module item ${itemId}:`, (err as Error).message);
      }
    }
  }

  // Step 4: Sync parties
  console.log(`\n\nStep 4: Syncing ${partyNames.size} parties...`);
  for (const partyName of partyNames) {
    await upsertParty(partyName, parliament.id);
  }

  // Step 5: Sync raadsleden
  console.log(`Step 5: Syncing ${personNames.size} raadsleden...`);
  for (const [personId, { name, partyName }] of personNames) {
    await upsertRaadslid(personId, name, partyName, parliament.id);
  }

  console.log(`\n✅ Sync complete for ${parliament.shortName}`);
  console.log(`  Moties found: ${totalMoties}`);
  console.log(`  New: ${totalNew}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped (not motie/amendement): ${totalSkipped}`);
  console.log(`  Parties: ${partyNames.size}`);
  console.log(`  Raadsleden: ${personNames.size}`);
}

// ── Database upsert helpers ────────────────────────────────

async function upsertMotie(
  motie: ParsedMotie,
  parliamentId: string,
  client: NotubizClient
): Promise<"created" | "updated" | "skipped"> {
  const externalId = `notubiz-${motie.moduleItemId}`;

  // Check if already exists
  const existing = await prisma.motion.findFirst({
    where: { externalId, parliamentId },
  });

  // Parse vote breakdown
  const breakdown = client.parseVoteBreakdown(motie.result, motie.resultExplanation);

  // Map result to standard format
  const resultStd =
    breakdown.result === "aangenomen" ? "Aangenomen" :
    breakdown.result === "verworpen" ? "Verworpen" :
    breakdown.result === "ingetrokken" ? "Ingetrokken" :
    motie.result || null;

  const data = {
    title: motie.title,
    text: motie.resultExplanation || motie.title, // Use toelichting as text, or title as fallback
    dateIntroduced: motie.dateSubmitted ? new Date(motie.dateSubmitted) : new Date(),
    status: motie.result || "onbekend",
    result: resultStd,
    soort: motie.type,
    sourceUrl: motie.documentUrl || `https://api.notubiz.nl/modules/0/items/${motie.moduleItemId}`,
    rawData: motie.rawAttributes as any,
    parliamentId,
    externalId,
    sourceSystem: "notubiz",
  };

  if (existing) {
    await prisma.motion.update({
      where: { id: existing.id },
      data,
    });
    return "updated";
  } else {
    // Need a unique tkId — use notubiz prefix
    const tkId = `NB-${motie.moduleItemId}`;
    await prisma.motion.create({
      data: {
        ...data,
        tkId,
      },
    });

    // Create Vote record (aggregate) if we have a result
    if (resultStd && resultStd !== "Ingetrokken") {
      const voteId = `NB-VOTE-${motie.moduleItemId}`;
      await prisma.vote.upsert({
        where: { tkId: voteId },
        create: {
          tkId: voteId,
          date: data.dateIntroduced,
          title: data.title,
          result: resultStd,
          totalFor: 0, // Not available from NotuBiz text (only per-party)
          totalAgainst: 0,
          totalAbstain: 0,
          sourceUrl: data.sourceUrl,
          rawData: { voteBreakdown: breakdown } as any,
          parliament: { connect: { id: parliamentId } },
          motion: { connect: { tkId } },
        },
        update: {
          result: resultStd,
          rawData: { voteBreakdown: breakdown } as any,
        },
      });
    }

    return "created";
  }
}

async function upsertParty(
  partyName: string,
  parliamentId: string
): Promise<void> {
  const existing = await prisma.party.findFirst({
    where: {
      abbreviation: partyName,
      parliamentId,
    },
  });

  if (!existing) {
    await prisma.party.create({
      data: {
        name: partyName,
        abbreviation: partyName,
        parliamentId,
        sourceSystem: "notubiz",
      },
    });
    console.log(`  Created party: ${partyName}`);
  }
}

async function upsertRaadslid(
  notubizPersonId: number,
  fullName: string,
  partyName: string,
  parliamentId: string
): Promise<void> {
  const externalId = `notubiz-person-${notubizPersonId}`;

  // Find the party
  const party = await prisma.party.findFirst({
    where: { abbreviation: partyName, parliamentId },
  });

  if (!party) {
    console.warn(`  ⚠ Party "${partyName}" not found for raadslid ${fullName}`);
    return;
  }

  const existing = await prisma.mp.findFirst({
    where: { externalId, parliamentId },
  });

  // Parse name parts (best effort)
  const nameParts = fullName.split(" ");
  const surname = nameParts[nameParts.length - 1];
  const initials = nameParts.length > 1 ? nameParts[0].charAt(0) + "." : null;
  const prefix = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null;

  if (!existing) {
    await prisma.mp.create({
      data: {
        tkId: `NB-P-${notubizPersonId}`,
        name: fullName,
        initials,
        prefix,
        surname,
        partyId: party.id,
        startDate: new Date("2022-03-01"), // Approximate start of municipal term
        parliamentId,
        externalId,
        sourceSystem: "notubiz",
      },
    });
    console.log(`  Created raadslid: ${fullName} (${partyName})`);
  }
}

// ── Utility ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Entry point ────────────────────────────────────────────

syncNotubiz()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
