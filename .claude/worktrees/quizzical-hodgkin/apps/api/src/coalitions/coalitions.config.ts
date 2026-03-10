/**
 * Shared coalition configuration for the CivicStat API.
 *
 * Defines Dutch cabinet coalitions with date ranges, abbreviation mapping,
 * and helper functions used by CoalitionDynamicsService, InsightsService,
 * and VotesService.
 */

// ─── Types ───────────────────────────────────────────────────

export interface CoalitionConfig {
  name: string;
  slug: string;
  parties: string[]; // abbreviations (e.g. "PVV", "VVD")
  startDate: string; // ISO date
  endDate: string | null; // null = still active
}

// ─── Coalition definitions ───────────────────────────────────

export const COALITIONS: CoalitionConfig[] = [
  {
    name: "Kabinet-Schoof",
    slug: "schoof",
    parties: ["PVV", "VVD", "NSC", "BBB"],
    startDate: "2024-07-02",
    endDate: "2025-10-29",
  },
  {
    name: "Kabinet-Jetten",
    slug: "jetten",
    parties: ["D66", "VVD", "CDA"],
    startDate: "2026-02-23",
    endDate: null,
  },
];

// ─── TK ActorNaam → normalized abbreviation ──────────────────
// The TK API uses various party name forms; normalize to abbreviations.

export const ABBR_MAP: Record<string, string> = {
  "GroenLinks-PvdA": "GL-PvdA",
  ChristenUnie: "CU",
  "Nieuw Sociaal Contract": "NSC",
  "Partij voor de Vrijheid (PVV)": "PVV",
  "Partij voor de Vrijheid": "PVV",
};

// ─── Tracked parties (all 15 TK parties with seats) ──────────

export const TRACKED_PARTIES = [
  "PVV",
  "GL-PvdA",
  "VVD",
  "NSC",
  "BBB",
  "D66",
  "CDA",
  "SP",
  "PvdD",
  "CU",
  "SGP",
  "DENK",
  "Volt",
  "JA21",
  "FVD",
];

// Pairs traditionally considered ideologically distant
export const UNLIKELY_PAIRS: [string, string][] = [
  ["PVV", "GL-PvdA"],
  ["PVV", "D66"],
  ["BBB", "GL-PvdA"],
  ["SP", "VVD"],
  ["PVV", "SP"],
  ["SGP", "D66"],
  ["DENK", "PVV"],
  ["PvdD", "VVD"],
  ["PvdD", "BBB"],
  ["FVD", "GL-PvdA"],
];

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Get the coalition that was active on a given date, or null.
 */
export function getCoalitionForDate(date: Date): CoalitionConfig | null {
  for (const c of COALITIONS) {
    const start = new Date(c.startDate);
    const end = c.endDate ? new Date(c.endDate) : new Date("2099-12-31");
    if (date >= start && date <= end) return c;
  }
  return null;
}

/**
 * Find a coalition by slug, or null if not found.
 */
export function getCoalitionBySlug(slug: string): CoalitionConfig | null {
  return COALITIONS.find((c) => c.slug === slug) ?? null;
}

/**
 * Extract party stances from a vote's rawData.Stemming array.
 * Returns Map<abbreviation, "FOR"|"AGAINST">.
 * Skips parties marked as "Niet deelgenomen" (absent).
 *
 * Works for both "met handopsteken" and "hoofdelijk" votes.
 */
export function extractPartyStances(vote: {
  rawData: any;
  records?: { voteValue: string; party: { abbreviation: string } }[];
}): Map<string, string> {
  const stances = new Map<string, string>();

  // Primary: rawData.Stemming (available for ALL vote types)
  const stemmingen: { ActorNaam: string; Soort: string }[] =
    vote.rawData?.Stemming ?? [];

  if (stemmingen.length > 0) {
    for (const s of stemmingen) {
      if (s.Soort === "Niet deelgenomen") continue;
      const name = ABBR_MAP[s.ActorNaam] ?? s.ActorNaam;
      const soort = s.Soort?.toLowerCase();
      if (soort === "voor") stances.set(name, "FOR");
      else if (soort === "tegen") stances.set(name, "AGAINST");
    }
    return stances;
  }

  // Fallback: VoteRecords (only for hoofdelijk with expanded records)
  if (vote.records && vote.records.length > 0) {
    const partyCounts = new Map<string, { for: number; against: number }>();
    for (const r of vote.records) {
      const abbr = r.party.abbreviation;
      if (!partyCounts.has(abbr))
        partyCounts.set(abbr, { for: 0, against: 0 });
      const counts = partyCounts.get(abbr)!;
      if (r.voteValue === "FOR") counts.for++;
      else if (r.voteValue === "AGAINST") counts.against++;
    }
    for (const [abbr, counts] of partyCounts) {
      if (counts.for > 0 || counts.against > 0) {
        stances.set(abbr, counts.for >= counts.against ? "FOR" : "AGAINST");
      }
    }
  }

  return stances;
}
