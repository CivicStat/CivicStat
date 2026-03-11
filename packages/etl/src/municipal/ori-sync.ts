/**
 * Open Raadsinformatie (ORI) Municipal Sync
 *
 * Syncs moties from Open Raadsinformatie Elasticsearch API
 * into the CivicStat database. Works for Rotterdam and Utrecht.
 *
 * Data model: AgendaItems named "Motie" + attached MediaObjects
 * with vote results in document names (aangenomen/verworpen/ingetrokken).
 *
 * Usage:
 *   npx tsx src/municipal/ori-sync.ts --parliament rotterdam
 *   npx tsx src/municipal/ori-sync.ts --parliament utrecht --from 2022-03-01
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORI_BASE = "https://api.openraadsinformatie.nl/v1/elastic";
const BATCH_SIZE = 100; // Elasticsearch scroll size
const SLEEP_MS = 200;

// ── Types ──────────────────────────────────────────────────

interface ORIHit {
  _id: string;
  _source: {
    name: string;
    "@type": string;
    "@id": string;
    attachment?: string | string[];
    parent?: string;
    start_date?: string;
    last_discussed_at?: string;
    text?: string | string[];
    original_url?: string;
    is_referenced_by?: string | string[];
    was_generated_by?: {
      reference_identifier?: string;
    };
  };
}

interface ParsedMotie {
  oriId: string;
  title: string;
  type: string; // "Motie" | "Amendement"
  date: string;
  result: "Aangenomen" | "Verworpen" | "Ingetrokken" | null;
  documentUrl: string | null;
  referenceId: string | null;
  submitterParties: string[];
}

// ── CLI / Export ───────────────────────────────────────────

export interface ORISyncParams {
  parliament: string;
  from?: string;
  to?: string;
}

export async function runORISync(params: ORISyncParams) {
  const parliament = await prisma.parliament.findUnique({
    where: { slug: params.parliament },
  });
  if (!parliament) {
    console.error(`Parliament "${params.parliament}" not found in database.`);
    process.exit(1);
  }

  const config = parliament.dataSourceConfig as { type: string; oriIndex?: string } | null;
  const indexPattern = config?.oriIndex || `ori_${params.parliament}*`;

  const dateFrom = params.from || "2022-03-01";
  const dateTo = params.to || new Date().toISOString().split("T")[0];

  console.log(`\n🏛️  Syncing ${parliament.shortName || parliament.name} from ORI (${indexPattern})`);
  console.log(`📅  Date range: ${dateFrom} → ${dateTo}\n`);

  // Step 1: Fetch all motie MediaObjects with vote results in name
  console.log("Step 1: Fetching motie documents from ORI...");
  let motieDocs = await fetchMotieDocuments(indexPattern, dateFrom, dateTo);
  console.log(`  Found ${motieDocs.length} motie documents with vote results in name`);

  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const partyNames = new Set<string>();

  // If no results from name-based approach, try list-based approach (Utrecht)
  if (motieDocs.length === 0) {
    console.log("\n  No name-based results. Trying list-based approach...");
    const listMotions = await fetchMotionsFromListDocs(indexPattern, dateFrom, dateTo);
    console.log(`  Found ${listMotions.length} motions from list documents`);

    for (let i = 0; i < listMotions.length; i++) {
      const motie = listMotions[i];
      for (const party of motie.submitterParties) {
        partyNames.add(party);
      }
      const result = await upsertMotie(motie, parliament.id);
      if (result === "created") totalNew++;
      else if (result === "updated") totalUpdated++;
      else totalSkipped++;

      if ((i + 1) % 50 === 0) {
        console.log(`  Processed ${i + 1}/${listMotions.length}...`);
      }
    }
  } else {
    // Step 2: Parse and upsert each motie (name-based approach)
    console.log("\nStep 2: Upserting motions and votes...");
    for (let i = 0; i < motieDocs.length; i++) {
      const doc = motieDocs[i];
      const parsed = parseMotieDocument(doc);

      if (!parsed) {
        totalSkipped++;
        continue;
      }

      for (const party of parsed.submitterParties) {
        partyNames.add(party);
      }

      const result = await upsertMotie(parsed, parliament.id);
      if (result === "created") totalNew++;
      else if (result === "updated") totalUpdated++;
      else totalSkipped++;

      if ((i + 1) % 50 === 0) {
        console.log(`  Processed ${i + 1}/${motieDocs.length}...`);
      }
    }
  }

  // Step 3: Sync parties
  console.log(`\nStep 3: Syncing ${partyNames.size} parties...`);
  for (const partyName of partyNames) {
    await upsertParty(partyName, parliament.id);
  }

  console.log(`\n✅ Sync complete for ${parliament.shortName || parliament.name}`);
  console.log(`  Moties found: ${motieDocs.length}`);
  console.log(`  New: ${totalNew}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Parties: ${partyNames.size}`);

  await prisma.$disconnect();
}

// ── ORI Elasticsearch queries ─────────────────────────────

async function fetchMotieDocuments(
  indexPattern: string,
  dateFrom: string,
  dateTo: string
): Promise<ORIHit[]> {
  const allHits: ORIHit[] = [];
  let from = 0;

  while (true) {
    const query = {
      size: BATCH_SIZE,
      from,
      query: {
        bool: {
          must: [
            { term: { "@type": "MediaObject" } },
            { match: { name: "motie" } },
            {
              bool: {
                should: [
                  { match_phrase: { name: "aangenomen" } },
                  { match_phrase: { name: "verworpen" } },
                  { match_phrase: { name: "ingetrokken" } },
                ],
              },
            },
            {
              range: {
                last_discussed_at: {
                  gte: `${dateFrom}T00:00:00+00:00`,
                  lte: `${dateTo}T23:59:59+00:00`,
                },
              },
            },
          ],
        },
      },
      _source: [
        "name",
        "original_url",
        "@id",
        "last_discussed_at",
        "is_referenced_by",
        "was_generated_by",
        "text",
      ],
      sort: [{ last_discussed_at: "asc" }],
    };

    const res = await fetch(`${ORI_BASE}/${indexPattern}/_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      throw new Error(`ORI API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const hits: ORIHit[] = data.hits?.hits || [];

    if (hits.length === 0) break;

    allHits.push(...hits);
    from += hits.length;

    const total =
      typeof data.hits?.total === "number"
        ? data.hits.total
        : data.hits?.total?.value || 0;

    if (from >= total) break;

    await sleep(SLEEP_MS);
  }

  // Deduplicate by oriId (same motion can appear multiple times)
  const seen = new Map<string, ORIHit>();
  for (const hit of allHits) {
    const oriId = hit._source["@id"] || hit._id;
    // Keep the latest version
    seen.set(oriId, hit);
  }

  return [...seen.values()];
}

/**
 * Fetch motions from "Lijst aangenomen moties" / "Aangenomen moties" list documents.
 * Used for Utrecht where individual motions don't have results in their names.
 */
async function fetchMotionsFromListDocs(
  indexPattern: string,
  dateFrom: string,
  dateTo: string
): Promise<ParsedMotie[]> {
  const allHits: ORIHit[] = [];
  let from = 0;

  while (true) {
    const query = {
      size: BATCH_SIZE,
      from,
      query: {
        bool: {
          must: [
            { term: { "@type": "MediaObject" } },
            { match: { name: "aangenomen moties" } },
            {
              range: {
                last_discussed_at: {
                  gte: `${dateFrom}T00:00:00+00:00`,
                  lte: `${dateTo}T23:59:59+00:00`,
                },
              },
            },
          ],
        },
      },
      _source: ["name", "text", "@id", "last_discussed_at"],
      sort: [{ last_discussed_at: "asc" }],
    };

    const res = await fetch(`${ORI_BASE}/${indexPattern}/_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      throw new Error(`ORI API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const hits: ORIHit[] = data.hits?.hits || [];
    if (hits.length === 0) break;
    allHits.push(...hits);
    from += hits.length;

    const total =
      typeof data.hits?.total === "number"
        ? data.hits.total
        : data.hits?.total?.value || 0;
    if (from >= total) break;
    await sleep(SLEEP_MS);
  }

  // Parse motions from list document text
  const motionMap = new Map<string, ParsedMotie>();

  for (const hit of allHits) {
    const text = Array.isArray(hit._source.text)
      ? hit._source.text[0] || ""
      : hit._source.text || "";
    const docDate = hit._source.last_discussed_at || "";

    // Extract motions using M-number pattern with surrounding context
    // Pattern: M77 Title\nMotie\naangenomen\nSubmitter (Party)
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const mMatch = lines[i].match(/^(M\d+[a-z]?)\s+(.+)/);
      if (!mMatch) continue;

      const mNumber = mMatch[1];
      const titleStart = mMatch[2];

      // Skip if already seen (keep first occurrence which is earliest)
      if (motionMap.has(mNumber)) continue;

      // Look ahead for more context: type, status, submitter
      let title = titleStart;
      let submitterParties: string[] = [];

      // Scan following lines for submitter info (person names with party in parens)
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        // Look for known party names in parentheses: "Name (Party)"
        const partyMatch = lines[j].match(/\(([^)]+)\)/g);
        if (partyMatch) {
          for (const pm of partyMatch) {
            const partyName = pm.replace(/[()]/g, "").trim();
            if (KNOWN_PARTIES.includes(partyName) || KNOWN_PARTIES.some(kp => kp.toLowerCase() === partyName.toLowerCase())) {
              submitterParties.push(partyName);
            }
          }
        }
        // Stop if we hit the next M-number
        if (/^M\d+[a-z]?\s/.test(lines[j])) break;
      }

      // Parse date from context if available (look for DD-MM-YYYY pattern near M-number)
      let motionDate = docDate;
      for (let j = Math.max(0, i - 3); j < Math.min(i + 3, lines.length); j++) {
        const dateMatch = lines[j].match(/(\d{2}-\d{2}-\d{4})/);
        if (dateMatch) {
          const [dd, mm, yyyy] = dateMatch[1].split("-");
          motionDate = `${yyyy}-${mm}-${dd}T00:00:00+00:00`;
          break;
        }
      }

      motionMap.set(mNumber, {
        oriId: `utrecht-${mNumber}`,
        title: `${mNumber} ${title}`,
        type: "Motie",
        date: motionDate,
        result: "Aangenomen", // These are all from "aangenomen moties" lists
        documentUrl: null,
        referenceId: mNumber,
        submitterParties: [...new Set(submitterParties)],
      });
    }
  }

  // Also fetch "VERWORPEN M..." individual docs
  const verworpenQuery = {
    size: 200,
    query: {
      bool: {
        must: [
          { term: { "@type": "MediaObject" } },
          { match_phrase: { name: "VERWORPEN" } },
          { match: { name: "M" } },
          {
            range: {
              last_discussed_at: {
                gte: `${dateFrom}T00:00:00+00:00`,
                lte: `${dateTo}T23:59:59+00:00`,
              },
            },
          },
        ],
      },
    },
    _source: ["name", "@id", "last_discussed_at", "text"],
  };

  const vRes = await fetch(`${ORI_BASE}/${indexPattern}/_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verworpenQuery),
  });

  if (vRes.ok) {
    const vData = await vRes.json();
    for (const hit of vData.hits?.hits || []) {
      const name = hit._source.name || "";
      const mMatch = name.match(/(M\d+[a-z]?)\s+(.+)/);
      if (!mMatch) continue;
      const mNumber = mMatch[1];
      const title = mMatch[2].replace(/\.docx$/i, "").trim();

      if (!motionMap.has(mNumber)) {
        motionMap.set(mNumber, {
          oriId: `utrecht-${mNumber}`,
          title: `${mNumber} ${title}`,
          type: "Motie",
          date: hit._source.last_discussed_at || "",
          result: "Verworpen",
          documentUrl: null,
          referenceId: mNumber,
          submitterParties: extractPartiesFromText(hit._source.text),
        });
      }
    }
  }

  return [...motionMap.values()];
}

// ── Parsing ───────────────────────────────────────────────

function parseMotieDocument(hit: ORIHit): ParsedMotie | null {
  const src = hit._source;
  const name = src.name || "";

  // Parse result from name: "... (aangenomen)" / "(verworpen)" / "(ingetrokken)"
  const resultMatch = name.match(/\((aangenomen|verworpen|ingetrokken)\)\s*$/i);
  if (!resultMatch) return null;

  const resultRaw = resultMatch[1].toLowerCase();
  const result =
    resultRaw === "aangenomen"
      ? "Aangenomen"
      : resultRaw === "verworpen"
        ? "Verworpen"
        : resultRaw === "ingetrokken"
          ? "Ingetrokken"
          : null;

  // Parse title: strip reference number, position, and result
  // Pattern: "[24bb002267] 6.1 Motie 9A De Feijenoordvisie (aangenomen)"
  let title = name
    .replace(/^\[[\w]+\]\s*/, "") // strip [reference]
    .replace(/^\d+(\.\d+)*\s+/, "") // strip position number
    .replace(/\s*\(aangenomen|verworpen|ingetrokken\)\s*$/i, "") // strip result
    .trim();

  // Determine type
  const type = /amendement/i.test(title) ? "Amendement" : "Motie";

  // Extract reference ID
  const refMatch = name.match(/^\[([\w]+)\]/);
  const referenceId = refMatch ? refMatch[1] : null;

  const oriId = src["@id"] || hit._id;
  const date =
    src.last_discussed_at || src.start_date || new Date().toISOString();

  // Extract submitter parties from text (best effort)
  const submitterParties = extractPartiesFromText(src.text);

  return {
    oriId,
    title,
    type,
    date,
    result,
    documentUrl: src.original_url || null,
    referenceId,
    submitterParties,
  };
}

// Known Rotterdam/Utrecht party names for extraction
const KNOWN_PARTIES = [
  "VVD",
  "D66",
  "GroenLinks",
  "PvdA",
  "CDA",
  "SP",
  "PVV",
  "ChristenUnie",
  "SGP",
  "DENK",
  "Volt",
  "PvdD",
  "Partij voor de Dieren",
  "Leefbaar Rotterdam",
  "50PLUS",
  "Nida",
  "Senaat",
  "Forum voor Democratie",
  "FvD",
  "JA21",
  "BBB",
  "NSC",
  "BIJ1",
  "STIP",
  "Student & Starter",
  "Utrechts Belang",
  "SBU",
  "EenUtrecht",
  "UtrechtNu!",
];

function extractPartiesFromText(
  text: string | string[] | undefined
): string[] {
  if (!text) return [];
  const fullText = Array.isArray(text) ? text.join("\n") : text;

  const found: string[] = [];
  for (const party of KNOWN_PARTIES) {
    if (fullText.includes(party)) {
      found.push(party);
    }
  }
  return found;
}

// ── Database upsert helpers ───────────────────────────────

async function upsertMotie(
  motie: ParsedMotie,
  parliamentId: string
): Promise<"created" | "updated" | "skipped"> {
  const externalId = `ori-${motie.oriId}`;
  const tkId = `ORI-${motie.oriId}`;

  const existing = await prisma.motion.findFirst({
    where: { externalId, parliamentId },
  });

  const data = {
    title: motie.title,
    text: motie.title, // ORI docs don't have structured motion text
    dateIntroduced: new Date(motie.date),
    status: motie.result?.toLowerCase() || "onbekend",
    result: motie.result,
    soort: motie.type,
    sourceUrl:
      motie.documentUrl ||
      `https://id.openraadsinformatie.nl/${motie.oriId}`,
    rawData: {
      referenceId: motie.referenceId,
      submitterParties: motie.submitterParties,
    } as any,
    parliamentId,
    externalId,
    sourceSystem: "ori",
  };

  if (existing) {
    await prisma.motion.update({
      where: { id: existing.id },
      data,
    });
    return "updated";
  }

  await prisma.motion.create({
    data: { ...data, tkId },
  });

  // Create Vote record if we have a result (not ingetrokken)
  if (motie.result && motie.result !== "Ingetrokken") {
    const voteId = `ORI-VOTE-${motie.oriId}`;
    await prisma.vote.upsert({
      where: { tkId: voteId },
      create: {
        tkId: voteId,
        date: new Date(motie.date),
        title: motie.title,
        result: motie.result,
        totalFor: 0,
        totalAgainst: 0,
        totalAbstain: 0,
        sourceUrl: data.sourceUrl,
        rawData: {
          source: "ori",
          referenceId: motie.referenceId,
        } as any,
        parliament: { connect: { id: parliamentId } },
        motion: { connect: { tkId } },
      },
      update: {
        result: motie.result,
      },
    });
  }

  return "created";
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
        sourceSystem: "ori",
      },
    });
    console.log(`  Created party: ${partyName}`);
  }
}

// ── Utility ───────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Entry point (direct run) ──────────────────────────────

const isDirectRun = process.argv[1]?.includes("ori-sync");
if (isDirectRun) {
  const args = process.argv.slice(2);
  let parliament = "";
  let from: string | undefined;
  let to: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--parliament" && args[i + 1]) parliament = args[++i];
    if (args[i] === "--from" && args[i + 1]) from = args[++i];
    if (args[i] === "--to" && args[i + 1]) to = args[++i];
  }

  if (!parliament) {
    console.error(
      "Usage: npx tsx src/municipal/ori-sync.ts --parliament <slug>"
    );
    console.error("  Slugs: rotterdam, utrecht");
    process.exit(1);
  }

  runORISync({ parliament, from, to }).catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
