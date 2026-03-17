/**
 * Eerste Kamer Sync
 *
 * Scrapes eerstekamer.nl and ingests fracties, leden, moties, and stemmingen
 * into the CivicStat database under parliament slug 'eerste-kamer'.
 */

import { PrismaClient } from '@prisma/client';
import {
  scrapeFracties,
  scrapeAllMoties,
  scrapeLeden,
  scrapeFractiegewijs,
  type EKFractie,
  type EKMotieVote,
  type EKFractieVote,
} from './ek-client.js';

const prisma = new PrismaClient();

const PARLIAMENT_SLUG = 'eerste-kamer';

// Map EK party names to TK abbreviations for linking
const EK_TO_TK_ABBREVIATION: Record<string, string> = {
  'GL-PvdA': 'GL-PvdA',
  'GroenLinks-PvdA': 'GL-PvdA',
  'BBB': 'BBB',
  'VVD': 'VVD',
  'D66': 'D66',
  'CDA': 'CDA',
  'PVV': 'PVV',
  'SP': 'SP',
  'CU': 'CU',
  'ChristenUnie': 'CU',
  'FVD': 'FVD',
  'PvdD': 'PvdD',
  'JA21': 'JA21',
  'Volt': 'Volt',
  'SGP': 'SGP',
  '50PLUS': '50PLUS',
  'OPNL': 'OPNL',
};

export interface EKSyncParams {
  from?: string;  // unused for now, kept for interface parity
}

export async function runEKSync(params?: EKSyncParams): Promise<void> {
  console.log('\n[EK-SYNC] Starting Eerste Kamer sync...');

  try {
    // 1. Ensure parliament exists
    const parliament = await ensureParliament();
    console.log(`[EK-SYNC] Parliament: ${parliament.name} (${parliament.id})`);

    // 2. Ingest fracties (parties)
    await syncFracties(parliament.id);

    // 3. Ingest leden (members)
    await syncLeden(parliament.id);

    // 4. Ingest moties with vote data
    await syncMoties(parliament.id);

    // 5. Aggregate votes from fractiegewijs data
    await syncFractiegewijs(parliament.id);

    // Print summary
    const [motionCount, voteCount, partyCount, mpCount] = await Promise.all([
      prisma.motion.count({ where: { parliamentId: parliament.id } }),
      prisma.vote.count({ where: { parliamentId: parliament.id } }),
      prisma.party.count({ where: { parliamentId: parliament.id } }),
      prisma.mp.count({ where: { parliamentId: parliament.id } }),
    ]);

    console.log(`\n[EK-SYNC] Summary:`);
    console.log(`  Parties: ${partyCount}`);
    console.log(`  Members: ${mpCount}`);
    console.log(`  Motions: ${motionCount}`);
    console.log(`  Votes: ${voteCount}`);
    console.log(`[EK-SYNC] Done.`);
  } finally {
    await prisma.$disconnect();
  }
}

// ── Parliament seed ───────────────────────────────────────

async function ensureParliament() {
  return prisma.parliament.upsert({
    where: { slug: PARLIAMENT_SLUG },
    update: {},
    create: {
      slug: PARLIAMENT_SLUG,
      name: 'Eerste Kamer der Staten-Generaal',
      shortName: 'Eerste Kamer',
      level: 'NATIONAL',
      country: 'NL',
      seats: 75,
      dataSourceConfig: {
        type: 'eerstekamer-scraper',
        baseUrl: 'https://www.eerstekamer.nl',
      },
    },
  });
}

// ── Fracties sync ─────────────────────────────────────────

async function syncFracties(parliamentId: string) {
  console.log('\n[EK-SYNC] Syncing fracties...');
  const fracties = await scrapeFracties();
  console.log(`[EK-SYNC] Found ${fracties.length} fracties`);

  for (const fractie of fracties) {
    const externalId = `ek-${fractie.slug}`;
    await prisma.party.upsert({
      where: { tkId: externalId },
      update: {
        name: fractie.name,
        abbreviation: fractie.abbreviation,
        seats: fractie.seats,
      },
      create: {
        tkId: externalId,
        name: fractie.name,
        abbreviation: fractie.abbreviation,
        seats: fractie.seats,
        parliamentId,
        sourceSystem: 'eerstekamer',
        externalId: fractie.slug,
      },
    });

    // Link to national party via PartyBranch if applicable
    const tkAbbr = EK_TO_TK_ABBREVIATION[fractie.name] || EK_TO_TK_ABBREVIATION[fractie.abbreviation];
    if (tkAbbr) {
      const nationalParty = await prisma.party.findFirst({
        where: {
          abbreviation: tkAbbr,
          sourceSystem: null, // TK parties don't have sourceSystem
          parliamentId: null, // or explicitly TK parliament
        },
      });
      if (!nationalParty) {
        // Try with TK parliament
        const tkParl = await prisma.parliament.findUnique({ where: { slug: 'tweede-kamer' } });
        if (tkParl) {
          const tkParty = await prisma.party.findFirst({
            where: { abbreviation: tkAbbr, parliamentId: tkParl.id },
          });
          if (tkParty) {
            await linkPartyBranch(parliamentId, externalId, tkParty.id);
          }
        }
      } else {
        await linkPartyBranch(parliamentId, externalId, nationalParty.id);
      }
    }

    console.log(`  [EK-SYNC] Party: ${fractie.name} (${fractie.abbreviation}) — ${fractie.seats} seats`);
  }
}

async function linkPartyBranch(parliamentId: string, ekTkId: string, nationalPartyId: string) {
  const localParty = await prisma.party.findUnique({ where: { tkId: ekTkId } });
  if (!localParty) return;

  await prisma.partyBranch.upsert({
    where: {
      partyId_parliamentId: {
        partyId: localParty.id,
        parliamentId,
      },
    },
    update: { nationalPartyId },
    create: {
      partyId: localParty.id,
      nationalPartyId,
      parliamentId,
    },
  });
}

// ── Leden sync ────────────────────────────────────────────

async function syncLeden(parliamentId: string) {
  console.log('\n[EK-SYNC] Syncing leden...');

  // Pre-cache parties for this parliament
  const parties = await prisma.party.findMany({
    where: { parliamentId },
    select: { id: true, abbreviation: true, name: true },
  });

  const findPartyId = buildPartyLookup(parties);

  // Parse the alle_leden page — each member card has:
  //   <a href="/persoon/SLUG">
  //     <div class="naam">NAME</div>
  //     <div>PARTY_ABBR</div>
  const html = await fetchPage('https://www.eerstekamer.nl/alle_leden');

  // Extract member blocks: slug, name, party from the HTML structure
  // Pattern: href="/persoon/SLUG" ... class="naam">NAME</div></div><div>PARTY</div>
  const memberRegex = /href="\/persoon\/([^"]+)"[\s\S]*?class="naam">([^<]+)<\/div><\/div><div>([^<]+)<\/div>/g;
  let match;
  let upserted = 0;

  while ((match = memberRegex.exec(html)) !== null) {
    const slug = match[1];
    const name = match[2].trim();
    const partyAbbr = match[3].trim();

    if (!name || name.length < 2) continue;

    // Find party ID
    const partyId = findPartyId(partyAbbr);

    if (!partyId) {
      console.warn(`  [EK-SYNC] Could not find party for member: ${name} (${partyAbbr})`);
      continue;
    }

    const externalId = `ek-lid-${slug}`;
    try {
      await prisma.mp.upsert({
        where: { tkId: externalId },
        update: {
          name,
          partyId,
        },
        create: {
          tkId: externalId,
          name,
          surname: name.split(' ').pop() || name,
          partyId,
          parliamentId,
          sourceSystem: 'eerstekamer',
          externalId: slug,
          startDate: new Date('2023-06-13'), // Current EK term started June 2023
        },
      });
      upserted++;
    } catch (err) {
      console.warn(`  [EK-SYNC] Failed to upsert member ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[EK-SYNC] Upserted ${upserted} members`);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ── Moties sync ───────────────────────────────────────────

async function syncMoties(parliamentId: string) {
  console.log('\n[EK-SYNC] Syncing moties...');
  const moties = await scrapeAllMoties();
  console.log(`[EK-SYNC] Found ${moties.length} moties with vote data`);

  // Pre-cache parties
  const parties = await prisma.party.findMany({
    where: { parliamentId },
    select: { id: true, abbreviation: true, name: true },
  });
  const findPartyId = buildPartyLookup(parties);

  for (const motie of moties) {
    const externalId = `ek-motie-${motie.dossierUrl}`;

    // Upsert motion
    const motion = await prisma.motion.upsert({
      where: { tkId: externalId },
      update: {
        title: motie.title.substring(0, 500),
        result: motie.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
      },
      create: {
        tkId: externalId,
        title: motie.title.substring(0, 500),
        text: motie.title, // Full text not available without deeper scraping
        dateIntroduced: motie.submittedDate ? new Date(motie.submittedDate) : new Date(motie.voteDate),
        status: motie.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
        result: motie.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
        soort: 'Motie',
        sourceUrl: `https://www.eerstekamer.nl${motie.dossierUrl}`,
        parliamentId,
        sourceSystem: 'eerstekamer',
        externalId: motie.dossierUrl,
        rawData: motie as any,
      },
    });

    // Upsert vote
    if (motie.voteDate) {
      const voteExternalId = `ek-vote-${motie.dossierUrl}`;
      await prisma.vote.upsert({
        where: { tkId: voteExternalId },
        update: {
          result: motie.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
          totalFor: motie.totalFor,
          totalAgainst: motie.totalAgainst,
        },
        create: {
          tkId: voteExternalId,
          motionId: motion.id,
          date: new Date(motie.voteDate),
          title: motie.title.substring(0, 500),
          result: motie.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
          totalFor: motie.totalFor,
          totalAgainst: motie.totalAgainst,
          sourceUrl: `https://www.eerstekamer.nl${motie.dossierUrl}`,
          parliamentId,
          rawData: {
            voteType: motie.voteType,
            partiesFor: motie.partiesFor,
            partiesAgainst: motie.partiesAgainst,
          },
        },
      });

      console.log(`  [EK-SYNC] Motie: ${motie.dossierNumber} — ${motie.result} (${motie.totalFor} voor, ${motie.totalAgainst} tegen)`);
    }
  }
}

// ── Fractiegewijs votes → aggregate into Vote + VoteRecord ──

async function syncFractiegewijs(parliamentId: string) {
  console.log('\n[EK-SYNC] Syncing fractiegewijs vote data...');
  const votes = await scrapeFractiegewijs();
  console.log(`[EK-SYNC] Found ${votes.length} party-level vote entries`);

  if (votes.length === 0) {
    console.log('[EK-SYNC] No fractiegewijs data found — skipping VoteRecord creation');
    return;
  }

  // Pre-cache parties
  const parties = await prisma.party.findMany({
    where: { parliamentId },
    select: { id: true, abbreviation: true, name: true },
  });
  const findPartyId = buildPartyLookup(parties);

  // Group votes by verslagUrl (same voting event)
  const votesByEvent = new Map<string, EKFractieVote[]>();
  for (const v of votes) {
    const key = `${v.voteDate}|${v.verslagUrl}`;
    if (!votesByEvent.has(key)) votesByEvent.set(key, []);
    votesByEvent.get(key)!.push(v);
  }

  console.log(`[EK-SYNC] Grouped into ${votesByEvent.size} voting events`);

  let createdVotes = 0;
  for (const [key, eventVotes] of votesByEvent) {
    const first = eventVotes[0];
    const voteExternalId = `ek-fvote-${key}`;

    // Count totals from party data
    const partiesForIds: string[] = [];
    const partiesAgainstIds: string[] = [];
    let totalFor = 0;
    let totalAgainst = 0;

    for (const v of eventVotes) {
      const partyId = findPartyId(v.partyName);
      if (!partyId) continue;

      const party = parties.find(p => p.id === partyId);
      if (v.direction === 'voor') {
        partiesForIds.push(partyId);
        // Use seat count as vote weight for party-level votes
      } else {
        partiesAgainstIds.push(partyId);
      }
    }

    // Try to find existing motion
    const dateStr = first.voteDate;
    let motionId: string | undefined;

    if (first.wetsvoorstelNumber) {
      const existing = await prisma.motion.findFirst({
        where: {
          parliamentId,
          tkId: { contains: first.wetsvoorstelNumber },
        },
      });
      motionId = existing?.id;
    }

    // Create/upsert vote
    try {
      const existingVote = await prisma.vote.findUnique({ where: { tkId: voteExternalId } });
      if (!existingVote) {
        // Create motion if we have a wetsvoorstel
        if (!motionId && first.wetsvoorstelTitle) {
          const motionExternalId = `ek-wv-${first.wetsvoorstelNumber || key}`;
          const motion = await prisma.motion.upsert({
            where: { tkId: motionExternalId },
            update: {},
            create: {
              tkId: motionExternalId,
              title: first.wetsvoorstelTitle.substring(0, 500),
              text: first.wetsvoorstelTitle,
              dateIntroduced: new Date(dateStr),
              status: first.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
              result: first.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
              soort: 'Wetsvoorstel',
              sourceUrl: `https://www.eerstekamer.nl${first.verslagUrl}`,
              parliamentId,
              sourceSystem: 'eerstekamer',
              externalId: first.wetsvoorstelNumber || key,
            },
          });
          motionId = motion.id;
        }

        await prisma.vote.create({
          data: {
            tkId: voteExternalId,
            motionId: motionId || null,
            date: new Date(dateStr),
            title: first.wetsvoorstelTitle || `EK stemming ${dateStr}`,
            result: first.result === 'aangenomen' ? 'Aangenomen' : 'Verworpen',
            totalFor,
            totalAgainst,
            sourceUrl: `https://www.eerstekamer.nl${first.verslagUrl}`,
            parliamentId,
            rawData: {
              voteType: first.voteType,
              partiesFor: partiesForIds,
              partiesAgainst: partiesAgainstIds,
              eventVotes: eventVotes.map(v => ({
                party: v.partyName,
                direction: v.direction,
              })),
            },
          },
        });
        createdVotes++;
      }
    } catch (err) {
      // Skip unique constraint violations
      if (!(err instanceof Error && err.message.includes('Unique constraint'))) {
        console.warn(`  [EK-SYNC] Failed to create vote ${voteExternalId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`[EK-SYNC] Created ${createdVotes} new votes from fractiegewijs data`);
}

// ── Helpers ───────────────────────────────────────────────

function buildPartyLookup(parties: Array<{ id: string; abbreviation: string; name: string }>) {
  const byAbbr = new Map(parties.map(p => [p.abbreviation.toLowerCase(), p.id]));
  const byName = new Map(parties.map(p => [p.name.toLowerCase(), p.id]));

  return (nameOrAbbr: string): string | undefined => {
    const lower = nameOrAbbr.toLowerCase().trim();
    return byAbbr.get(lower)
      || byName.get(lower)
      || byAbbr.get(lower.replace('fractie-', ''))
      || byName.get(lower.replace('fractie-', ''))
      || byAbbr.get(lower.replace('-fractie', ''))
      || undefined;
  };
}
