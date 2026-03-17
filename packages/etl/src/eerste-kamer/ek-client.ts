/**
 * Eerste Kamer HTML scraper client
 *
 * The Eerste Kamer has no OData/REST API — data is scraped from eerstekamer.nl.
 * The TK OData API contains EK member records (Persoon with Functie="Eerste Kamerlid")
 * but not EK votes or motions.
 */

const BASE_URL = 'https://www.eerstekamer.nl';
const SLEEP_MS = 300; // Be polite

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(path: string): Promise<string> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ── Fracties (parties) ────────────────────────────────────

export interface EKFractie {
  slug: string;
  name: string;       // e.g. "GroenLinks-PvdA"
  abbreviation: string; // e.g. "GL-PvdA"
  seats: number;
}

// Map party display names to standard abbreviations
const ABBREVIATION_MAP: Record<string, string> = {
  'GroenLinks-PvdA': 'GL-PvdA',
  'BBB': 'BBB',
  'VVD': 'VVD',
  'D66': 'D66',
  'CDA': 'CDA',
  'PVV': 'PVV',
  'SP': 'SP',
  'ChristenUnie': 'CU',
  'FVD': 'FVD',
  'PvdD': 'PvdD',
  'JA21': 'JA21',
  'Volt': 'Volt',
  'SGP': 'SGP',
  '50PLUS': '50PLUS',
  'OPNL': 'OPNL',
  'Fractie-Visseren-Hamakers': 'Visseren-Hamakers',
  'Fractie-Beukering': 'Beukering',
  'Fractie-Walenkamp': 'Walenkamp',
  'Fractie-Van de Sanden': 'Van de Sanden',
};

export async function scrapeFracties(): Promise<EKFractie[]> {
  const html = await fetchPage('/fracties');
  const fracties: EKFractie[] = [];

  // Each line has: href="/fractie/SLUG" ... >PARTYNAME (N zetels)</a>
  // Use a simpler regex that matches the pattern on each line
  const lines = html.split('\n');
  for (const line of lines) {
    const match = line.match(/href="\/fractie\/([^"]+)"[\s\S]*?<\/div><\/div>([^<(]+)\s*\((\d+)\s*zetels?\)/);
    if (match) {
      const slug = match[1];
      const name = match[2].trim();
      const seats = parseInt(match[3]);
      const abbreviation = ABBREVIATION_MAP[name] || name;
      fracties.push({ slug, name, abbreviation, seats });
    }
  }

  return fracties;
}

// ── Leden (members) ───────────────────────────────────────

export interface EKLid {
  slug: string;       // URL slug e.g. "mr_r_m_j_van_gasteren_llm_bbb"
  name: string;       // Full display name
  partySlug: string;  // Party extracted from slug suffix
}

export async function scrapeLeden(): Promise<EKLid[]> {
  const html = await fetchPage('/alle_leden');
  const leden: EKLid[] = [];

  // Pattern: href="/persoon/slug" with party suffix in parentheses
  const linkRegex = /href="\/persoon\/([^"]+)"/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1];
    // Skip duplicates
    if (leden.some(l => l.slug === slug)) continue;
    leden.push({ slug, name: '', partySlug: '' });
  }

  return leden;
}

// Scrape individual member page for name and party
export async function scrapeLid(slug: string): Promise<{ name: string; party: string } | null> {
  try {
    const html = await fetchPage(`/persoon/${slug}`);
    // Extract name from <h1>
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const name = nameMatch ? nameMatch[1].trim() : slug;

    // Extract party from "Fractie: X" or party link
    const partyMatch = html.match(/href="\/fractie\/[^"]*"[^>]*>[^<]*<[^>]*>[^<]*<[^>]*>[^<]*<\/svg><\/div><\/div>([^<]+)/);
    const party = partyMatch ? partyMatch[1].trim() : '';

    return { name, party };
  } catch {
    return null;
  }
}

// ── Moties with vote data ─────────────────────────────────

export interface EKMotieVote {
  dossierUrl: string;
  dossierNumber: string;  // e.g. "36755, K"
  title: string;
  submittedDate: string;
  voteDate: string;
  voteType: string;       // "hoofdelijke stemming" | "stemming bij zitten en opstaan"
  result: string;         // "verworpen" | "aangenomen"
  totalFor: number;
  totalAgainst: number;
  partiesFor: string[];
  partiesAgainst: string[];
  indieners: string[];
  dossierTitle: string;
}

export async function scrapeAllMoties(maxPages = 40): Promise<EKMotieVote[]> {
  const moties: EKMotieVote[] = [];
  const seenUrls = new Set<string>();
  let page = 0;
  const pageSize = 5; // EK default page size for moties

  while (page < maxPages) {
    const url = page === 0
      ? '/moties_6'
      : `/moties_6?start_00m=${page * pageSize}`;

    console.log(`  [EK] Fetching moties page ${page + 1}: ${url}`);
    const html = await fetchPage(url);

    // Extract motiedossier links
    const dossierLinks: string[] = [];
    const linkRegex = /href="(\/motiedossier\/[^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      if (!seenUrls.has(match[1])) {
        seenUrls.add(match[1]);
        dossierLinks.push(match[1]);
      }
    }

    if (dossierLinks.length === 0) break;

    // Scrape each motiedossier
    for (const link of dossierLinks) {
      await sleep(SLEEP_MS);
      const motie = await scrapeMotiedossier(link);
      if (motie) {
        moties.push(motie);
        console.log(`    [EK] Motie: ${motie.dossierNumber} — ${motie.result} (${motie.totalFor}v/${motie.totalAgainst}t)`);
      }
    }

    // Check if there's a next page
    const nextPageRegex = new RegExp(`start_00m=${(page + 1) * pageSize}`);
    if (!nextPageRegex.test(html)) break;

    page++;
    await sleep(SLEEP_MS);
  }

  return moties;
}

async function scrapeMotiedossier(path: string): Promise<EKMotieVote | null> {
  try {
    const html = await fetchPage(path);

    // Extract all td.fontwit contents
    const tdTexts: string[] = [];
    const tdRegex = /<td[^>]*class="fontwit"[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(html)) !== null) {
      const text = tdMatch[1].replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 0) tdTexts.push(text);
    }

    // Find the toelichting text — it contains "stemming" or "aangenomen" or "verworpen"
    let toelichting = '';
    let dossierNumber = '';
    let submittedDate = '';

    for (let i = 0; i < tdTexts.length; i++) {
      const text = tdTexts[i];
      if (text.match(/\d{2}\.\d{3}/)) {
        dossierNumber = dossierNumber || text;
      }
      if (text.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i) && !submittedDate) {
        submittedDate = text;
      }
      if (text.match(/stemming|aangenomen|verworpen/i) && text.length > 30) {
        toelichting = text;
        break;
      }
    }

    if (!toelichting) return null;

    // Parse the toelichting for vote details
    const voteDetails = parseVoteToelichting(toelichting);
    if (!voteDetails) return null;

    // Extract title from meta description
    const titleMatch = html.match(/<meta name="Description" content="([^"]+)"/);
    const title = titleMatch
      ? titleMatch[1].substring(0, 500)
      : path.split('/').pop()?.replace(/_/g, ' ') || 'Onbekende motie';

    return {
      dossierUrl: path,
      dossierNumber,
      title,
      submittedDate: parseNLDate(submittedDate) || submittedDate,
      voteDate: voteDetails.date,
      voteType: voteDetails.type,
      result: voteDetails.result,
      totalFor: voteDetails.totalFor,
      totalAgainst: voteDetails.totalAgainst,
      partiesFor: voteDetails.partiesFor,
      partiesAgainst: voteDetails.partiesAgainst,
      indieners: [],
      dossierTitle: '',
    };
  } catch (err) {
    console.warn(`  [EK] Failed to scrape motiedossier ${path}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Wetsvoorstel stemmingen ───────────────────────────────

export interface EKWetsvoorstelVote {
  wetsvoorstelUrl: string;
  number: string;       // e.g. "36859"
  title: string;
  voteDate: string;
  voteType: string;
  result: string;
  totalFor: number;
  totalAgainst: number;
  partiesFor: string[];
  partiesAgainst: string[];
}

export async function scrapeWetsvoorstelStemmingen(): Promise<EKWetsvoorstelVote[]> {
  const votes: EKWetsvoorstelVote[] = [];
  let page = 0;
  const pageSize = 25; // Default pagination size

  while (true) {
    const url = page === 0
      ? '/stemmingen_per_vergaderdag?filter=wetsvoorstellen'
      : `/stemmingen_per_vergaderdag?filter=wetsvoorstellen&start_006=${page * pageSize}`;

    console.log(`  [EK] Fetching wetsvoorstel stemmingen page ${page + 1}: ${url}`);
    const html = await fetchPage(url);

    // Find verslagdeel links that are actual votes (not hamerstuk = voice votes without opposition)
    const verslagRegex = /href="(\/verslagdeel\/\d{8}\/[^"]*)"[^>]*>[^<]*<\/a>[^<]*\((Stemming[^)]+)\)/g;
    let match;
    const entries: Array<{ verslagUrl: string; voteInfo: string }> = [];
    while ((match = verslagRegex.exec(html)) !== null) {
      entries.push({ verslagUrl: match[1], voteInfo: match[2] });
    }

    // Also extract wetsvoorstel links and their associated vote text
    // Pattern on page: wetsvoorstel link + vote result text
    const wvRegex = /href="(\/wetsvoorstel\/[^"]+)"[^>]*>([^<]+)<\/a>[^]*?(?:Stemming[^,)]+,\s*(aangenomen|verworpen))/g;
    while ((match = wvRegex.exec(html)) !== null) {
      // These are in the page listing — we need to visit individual pages for details
    }

    if (entries.length === 0 && page > 0) break;

    // Check for next page
    const nextRegex = new RegExp(`start_006=${(page + 1) * pageSize}`);
    if (!nextRegex.test(html)) break;

    page++;
    await sleep(SLEEP_MS);
  }

  return votes;
}

// ── Scrape stemmingen_fractiegewijs for comprehensive vote data ──

export interface EKFractieVote {
  partyName: string;
  voteDate: string;
  voteType: string;     // "Hoofdelijke stemming" | "Hamerstuk" | "Stemming bij zitten en opstaan"
  result: string;       // "aangenomen" | "verworpen"
  direction: 'voor' | 'tegen';
  wetsvoorstelNumber?: string;
  wetsvoorstelTitle?: string;
  motieNumber?: string;
  verslagUrl: string;
}

export async function scrapeFractiegewijs(): Promise<EKFractieVote[]> {
  console.log('  [EK] Scraping stemmingen fractiegewijs...');
  const html = await fetchPage('/stemmingen_fractiegewijs');
  const allVotes: EKFractieVote[] = [];

  // Split HTML by party headings: <a href="/fractie/SLUG">NAME-fractie</a></h2>
  const partyHeadingRegex = /href="\/fractie\/[^"]*">([^<]+)<\/a><\/h2>/g;
  const partyPositions: Array<{ name: string; start: number }> = [];
  let m;
  while ((m = partyHeadingRegex.exec(html)) !== null) {
    partyPositions.push({
      name: m[1].replace(/-fractie$/i, '').trim(),
      start: m.index + m[0].length,
    });
  }

  for (let i = 0; i < partyPositions.length; i++) {
    const partyName = partyPositions[i].name;
    const blockStart = partyPositions[i].start;
    const blockEnd = i + 1 < partyPositions.length ? partyPositions[i + 1].start : html.length;
    const votesBlock = html.substring(blockStart, blockEnd);

    // Each vote: <img alt="Voor|Tegen"> ... <strong><a href="URL">DATE</a></strong> (TYPE, RESULT)<br/>
    // The img and strong may be separated by whitespace/spans
    const voteRegex = /alt="(Voor|Tegen)"[\s\S]*?<strong><a href="([^"]+)">([^<]+)<\/a><\/strong>\s*\(([^)]+)\)/g;
    let voteMatch;

    while ((voteMatch = voteRegex.exec(votesBlock)) !== null) {
      const direction = voteMatch[1].toLowerCase() as 'voor' | 'tegen';
      const verslagUrl = voteMatch[2];
      const dateStr = voteMatch[3].trim();
      const voteInfo = voteMatch[4].trim();

      const parts = voteInfo.split(',').map(s => s.trim());
      const voteType = parts[0];
      const result = parts[1] || 'aangenomen'; // Hamerstuk = always aangenomen

      // Check for wetsvoorstel number in the following text
      const afterVote = votesBlock.substring(voteMatch.index + voteMatch[0].length, voteMatch.index + voteMatch[0].length + 500);
      const wvMatch = afterVote.match(/href="\/wetsvoorstel\/([^"]+)"[^>]*>([^<]*\d{2}\.\d{3}[^<]*)<\/a>/);

      allVotes.push({
        partyName,
        voteDate: parseNLDate(dateStr) || dateStr,
        voteType,
        result: result.toLowerCase(),
        direction,
        wetsvoorstelNumber: wvMatch ? wvMatch[1].split('_')[0] : undefined,
        wetsvoorstelTitle: wvMatch ? wvMatch[2].trim() : undefined,
        verslagUrl,
      });
    }
  }

  return allVotes;
}

// ── Helpers ───────────────────────────────────────────────

const NL_MONTHS: Record<string, string> = {
  'januari': '01', 'februari': '02', 'maart': '03', 'april': '04',
  'mei': '05', 'juni': '06', 'juli': '07', 'augustus': '08',
  'september': '09', 'oktober': '10', 'november': '11', 'december': '12',
};

function parseNLDate(dateStr: string): string | null {
  // "10 maart 2026" → "2026-03-10"
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = NL_MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${day}`;
}

interface VoteDetails {
  date: string;
  type: string;
  result: string;
  totalFor: number;
  totalAgainst: number;
  partiesFor: string[];
  partiesAgainst: string[];
}

function parseVoteToelichting(text: string): VoteDetails | null {
  // "Na hoofdelijke stemming op 10 maart 2026 met 25 leden voor en 46 leden tegen verworpen.
  //  Voor: SGP, FVD, PVV, JA21, BBB, 50PLUS, Fractie-Walenkamp en Fractie-Beukering."
  //
  // Also: "Bij zitten en opstaan met algemene stemmen aangenomen op 24 februari 2026."
  // Also: "Bij zitten en opstaan aangenomen op 3 februari 2026. PVV, FVD, JA21 en Fractie-Beukering stemden tegen."

  let type = 'stemming';
  let result = 'aangenomen';
  let totalFor = 0;
  let totalAgainst = 0;
  let date = '';
  const partiesFor: string[] = [];
  const partiesAgainst: string[] = [];

  // Try hoofdelijke stemming pattern
  const hoofdelijkMatch = text.match(
    /(?:Na\s+)?(?:h|H)oofdelijke stemming\s+op\s+(\d{1,2}\s+\w+\s+\d{4})\s+met\s+(\d+)\s+leden?\s+voor\s+en\s+(\d+)\s+leden?\s+tegen\s+(aangenomen|verworpen)/i
  );

  if (hoofdelijkMatch) {
    type = 'hoofdelijke stemming';
    date = parseNLDate(hoofdelijkMatch[1]) || hoofdelijkMatch[1];
    totalFor = parseInt(hoofdelijkMatch[2]);
    totalAgainst = parseInt(hoofdelijkMatch[3]);
    result = hoofdelijkMatch[4].toLowerCase();

    // Parse "Voor: ..." parties
    const voorMatch = text.match(/Voor:\s*([^.]+)/);
    if (voorMatch) {
      const parties = voorMatch[1].replace(/\s+en\s+/g, ', ').split(',').map(s => s.trim()).filter(Boolean);
      partiesFor.push(...parties);
    }

    // Parse "Tegen: ..." if present (less common)
    const tegenMatch = text.match(/Tegen:\s*([^.]+)/);
    if (tegenMatch) {
      const parties = tegenMatch[1].replace(/\s+en\s+/g, ', ').split(',').map(s => s.trim()).filter(Boolean);
      partiesAgainst.push(...parties);
    }

    return { date, type, result, totalFor, totalAgainst, partiesFor, partiesAgainst };
  }

  // Try zitten en opstaan pattern (two variants)
  // Variant 1: "Bij zitten en opstaan RESULT op DATE"
  const zittenMatch1 = text.match(
    /(?:Bij\s+)?zitten en opstaan(?:\s+met\s+algemene\s+stemmen)?\s+(aangenomen|verworpen)\s+op\s+(\d{1,2}\s+\w+\s+\d{4})/i
  );
  // Variant 2: "Op DATE na stemming bij zitten en opstaan RESULT"
  const zittenMatch2 = text.match(
    /(?:Op\s+)?(\d{1,2}\s+\w+\s+\d{4})\s+(?:na\s+)?stemming\s+bij\s+zitten en opstaan\s+(aangenomen|verworpen)/i
  );

  const zittenMatch = zittenMatch1 || zittenMatch2;
  if (zittenMatch) {
    type = 'stemming bij zitten en opstaan';
    if (zittenMatch1) {
      result = zittenMatch1[1].toLowerCase();
      date = parseNLDate(zittenMatch1[2]) || zittenMatch1[2];
    } else {
      date = parseNLDate(zittenMatch2![1]) || zittenMatch2![1];
      result = zittenMatch2![2].toLowerCase();
    }

    // Check for parties that voted against
    const tegenMatch = text.match(/([A-Za-z0-9,\s\-]+)\s+stemden?\s+tegen/);
    if (tegenMatch) {
      const parties = tegenMatch[1].replace(/\s+en\s+/g, ', ').split(',').map(s => s.trim()).filter(Boolean);
      partiesAgainst.push(...parties);
    }

    // Check for parties that voted for
    const voorStemMatch = text.match(/([A-Za-z0-9,\s\-]+)\s+stemden?\s+voor/);
    if (voorStemMatch) {
      const parties = voorStemMatch[1].replace(/\s+en\s+/g, ', ').split(',').map(s => s.trim()).filter(Boolean);
      partiesFor.push(...parties);
    }

    return { date, type, result, totalFor, totalAgainst, partiesFor, partiesAgainst };
  }

  // Try "met algemene stemmen" (unanimous) pattern
  const unanimousMatch = text.match(
    /(?:Op\s+)?(\d{1,2}\s+\w+\s+\d{4})[\s\S]*?met\s+algemene\s+stemmen\s+(aangenomen|verworpen)/i
  );
  if (unanimousMatch) {
    date = parseNLDate(unanimousMatch[1]) || unanimousMatch[1];
    result = unanimousMatch[2].toLowerCase();
    type = 'met algemene stemmen';
    return { date, type, result, totalFor: 75, totalAgainst: 0, partiesFor, partiesAgainst };
  }

  // Try generic stemming pattern
  const genericMatch = text.match(/(aangenomen|verworpen)\s+(?:op\s+)?(\d{1,2}\s+\w+\s+\d{4})/i);
  if (!genericMatch) {
    // Also try: "Op DATE ... RESULT"
    const generic2 = text.match(/(?:Op\s+)?(\d{1,2}\s+\w+\s+\d{4})[\s\S]*?(aangenomen|verworpen)/i);
    if (generic2) {
      date = parseNLDate(generic2[1]) || generic2[1];
      result = generic2[2].toLowerCase();
      return { date, type, result, totalFor, totalAgainst, partiesFor, partiesAgainst };
    }
  }
  if (genericMatch) {
    result = genericMatch[1].toLowerCase();
    date = parseNLDate(genericMatch[2]) || genericMatch[2];
    return { date, type, result, totalFor, totalAgainst, partiesFor, partiesAgainst };
  }

  return null;
}

// ── All-in-one stemmingen scraper (comprehensive) ─────────

export interface EKStemming {
  verslagUrl: string;
  title: string;
  soort: 'Motie' | 'Wetsvoorstel';
  dossierNumber: string;
  voteDate: string;
  voteType: string;
  result: string;
  totalFor: number;
  totalAgainst: number;
  partiesFor: string[];
  partiesAgainst: string[];
  sourceUrl: string;
}

/**
 * Scrape ALL stemmingen from the vergaderdag listing.
 * This is the most comprehensive source — includes both moties and wetsvoorstellen.
 */
export async function scrapeAllStemmingen(): Promise<EKStemming[]> {
  const stemmingen: EKStemming[] = [];
  let page = 0;
  const pageSize = 25;

  while (true) {
    const url = page === 0
      ? '/stemmingen_per_vergaderdag?filter=alles'
      : `/stemmingen_per_vergaderdag?filter=alles&start_006=${page * pageSize}`;

    console.log(`  [EK] Fetching stemmingen page ${page + 1}: ${url}`);
    const html = await fetchPage(url);

    // Look for motiedossier entries with vote data
    const motieLinks = new Set<string>();
    const motieLinkRegex = /href="(\/motiedossier\/[^"]+)"/g;
    let m;
    while ((m = motieLinkRegex.exec(html)) !== null) {
      motieLinks.add(m[1]);
    }

    // Scrape each unique motiedossier
    for (const link of motieLinks) {
      if (stemmingen.some(s => s.sourceUrl === link)) continue;
      await sleep(SLEEP_MS);
      const motie = await scrapeMotiedossier(link);
      if (motie) {
        stemmingen.push({
          verslagUrl: link,
          title: motie.title,
          soort: 'Motie',
          dossierNumber: motie.dossierNumber,
          voteDate: motie.voteDate,
          voteType: motie.voteType,
          result: motie.result,
          totalFor: motie.totalFor,
          totalAgainst: motie.totalAgainst,
          partiesFor: motie.partiesFor,
          partiesAgainst: motie.partiesAgainst,
          sourceUrl: link,
        });
      }
    }

    // Check for next page pagination link
    const nextLink = `/stemmingen_per_vergaderdag?filter=alles&start_006=${(page + 1) * pageSize}`;
    if (!html.includes(`start_006=${(page + 1) * pageSize}`)) break;

    page++;
    await sleep(SLEEP_MS);
  }

  return stemmingen;
}
