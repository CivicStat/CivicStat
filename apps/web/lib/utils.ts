// ─── Date formatting ────────────────────────────────────────

const MONTHS_NL = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

export function formatDate(d: string | Date): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "–";
  return `${date.getDate()} ${MONTHS_NL[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateShort(d: string | Date): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "–";
  return `${date.getDate()} ${MONTHS_NL[date.getMonth()]}`;
}

// ─── Initials ───────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter((p) => p.length > 1 && p[0] === p[0].toUpperCase())
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

// ─── Party colors ───────────────────────────────────────────

// Fallback colors for parties when colorNeutral isn't in DB
const PARTY_COLORS: Record<string, string> = {
  VVD: "#FF6600",
  PVV: "#002F6C",
  NSC: "#005CA9",
  BBB: "#95C11F",
  "GL-PvdA": "#B71C1C",
  "GroenLinks-PvdA": "#B71C1C",
  D66: "#00A651",
  SP: "#FF0000",
  CDA: "#007B5F",
  PvdD: "#006B2D",
  CU: "#00AEEF",
  ChristenUnie: "#00AEEF",
  FVD: "#8B0000",
  SGP: "#FF6700",
  DENK: "#00B4D8",
  Volt: "#502379",
  JA21: "#1B365D",
};

export function getPartyColor(abbreviation: string, colorNeutral?: string | null): string {
  if (colorNeutral) return colorNeutral;
  return PARTY_COLORS[abbreviation] || "#64748B";
}

// ─── Vote helpers ───────────────────────────────────────────

export function voteBarPercents(
  voor: number,
  tegen: number,
  afwezig: number = 0
): { pVoor: number; pTegen: number; pAfwezig: number } {
  const total = voor + tegen + afwezig || 1;
  return {
    pVoor: (voor / total) * 100,
    pTegen: (tegen / total) * 100,
    pAfwezig: (afwezig / total) * 100,
  };
}

// ─── Display name ───────────────────────────────────────────

export function mpDisplayName(mp: { name: string; surname: string; prefix?: string | null }): string {
  return mp.prefix ? `${mp.name} ${mp.prefix} ${mp.surname}` : `${mp.name} ${mp.surname}`;
}

// ─── clsx (tiny) ────────────────────────────────────────────

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
