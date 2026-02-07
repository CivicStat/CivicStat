import Link from "next/link";
import { getMotion } from "../../../lib/api";
import { formatDate, getInitials, getPartyColor } from "../../../lib/utils";
import PartyBadge from "../../../components/PartyBadge";
import StatusBadge from "../../../components/StatusBadge";
import VoteBar from "../../../components/VoteBar";
import type { VoteRecord, RawStemming } from "../../../lib/types";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  try {
    const m = await getMotion(params.id);
    return { title: `${m.title} — CivicStat` };
  } catch {
    return { title: "Motie — CivicStat" };
  }
}

export default async function MotieDetailPage({ params }: Props) {
  let motion;
  try {
    motion = await getMotion(params.id);
  } catch {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
        <Link
          href="/moties"
          className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-ink transition-colors mb-6"
        >
          &larr; Terug naar moties
        </Link>
        <div className="card p-6 text-text-secondary text-sm">
          Deze motie kon niet worden geladen.
        </div>
      </div>
    );
  }

  const m = motion;
  const vote = m.vote;
  const firstSponsor = m.sponsors?.[0]?.mp;
  const firstSponsorParty = firstSponsor?.party;

  const stemmingsSoort = vote?.rawData?.StemmingsSoort || "";
  const isHoofdelijk = stemmingsSoort === "Hoofdelijk";
  const hasRecords = vote?.records && vote.records.length > 0;
  const rawStemmingen: RawStemming[] = vote?.rawData?.Stemming || [];

  const partyAggregates = hasRecords
    ? aggregateByPartyFromRecords(vote!.records)
    : rawStemmingen.length > 0
    ? aggregateByPartyFromRaw(rawStemmingen)
    : null;

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6 pb-24">
      <Link
        href="/moties"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-ink transition-colors mb-6"
      >
        <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Terug naar moties
      </Link>

      <div className="mb-7">
        <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
          {m.tkNumber && (
            <span className="text-[13px] text-text-tertiary font-medium">
              Motie {m.tkNumber}
            </span>
          )}
          <span className="text-text-tertiary text-[10px]">&middot;</span>
          <span className="text-[13px] text-text-tertiary">
            {formatDate(m.dateIntroduced)}
          </span>
          <StatusBadge status={m.status} />
        </div>
        <h1 className="font-serif text-2xl sm:text-[32px] font-normal text-ink leading-tight max-w-[700px]">
          {m.title}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="card p-[18px]">
          <div className="section-label">Wat is besloten</div>
          <p className="text-sm leading-relaxed text-text-secondary">
            {m.text.length > 140 ? m.text.slice(0, 140) + "\u2026" : m.text}
          </p>
        </div>

        {vote && (
          <div className="card p-[18px]">
            <div className="section-label">Uitslag</div>
            <div className="flex items-baseline gap-2 mb-2.5">
              <span className="text-[30px] font-serif text-ink">{vote.totalFor}</span>
              <span className="text-[13px] text-text-tertiary">voor</span>
              <span className="text-[30px] font-serif text-text-secondary">{vote.totalAgainst}</span>
              <span className="text-[13px] text-text-tertiary">tegen</span>
            </div>
            <VoteBar voor={vote.totalFor} tegen={vote.totalAgainst} height={10} />
          </div>
        )}

        {firstSponsor && (
          <div className="card p-[18px]">
            <div className="section-label">Indiener</div>
            <Link href={`/kamerleden/${firstSponsor.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[13px] font-semibold text-ink"
                style={{
                  background: firstSponsorParty
                    ? `linear-gradient(135deg, ${getPartyColor(firstSponsorParty.abbreviation, firstSponsorParty.colorNeutral)}22, ${getPartyColor(firstSponsorParty.abbreviation, firstSponsorParty.colorNeutral)}44)`
                    : "#EEF1F5",
                  border: `2px solid ${firstSponsorParty ? getPartyColor(firstSponsorParty.abbreviation, firstSponsorParty.colorNeutral) + "33" : "#DDE1E8"}`,
                }}
              >
                {getInitials(firstSponsor.surname)}
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">{firstSponsor.name}</div>
                {firstSponsorParty && (
                  <PartyBadge abbreviation={firstSponsorParty.abbreviation} colorNeutral={firstSponsorParty.colorNeutral} size="sm" />
                )}
              </div>
            </Link>
          </div>
        )}

        <div className="card p-[18px]">
          <div className="section-label">Soort stemming</div>
          <div className="text-sm font-semibold text-ink mb-1">
            {isHoofdelijk ? "Hoofdelijk" : "Met handopsteken"}
          </div>
          <p className="text-[13px] leading-snug text-text-tertiary">
            {isHoofdelijk
              ? "Individuele stemmen per Kamerlid beschikbaar."
              : "Partijniveau — geen individuele stemmen beschikbaar."}
          </p>
        </div>
      </div>

      {m.sponsors && m.sponsors.length > 1 && (
        <div className="mb-8">
          <h2 className="font-serif text-[22px] font-normal text-ink mb-4">
            Mede-indieners ({m.sponsors.length - 1})
          </h2>
          <div className="flex flex-wrap gap-2">
            {m.sponsors.slice(1).map((s) => (
              <Link
                key={s.mp.id}
                href={`/kamerleden/${s.mp.id}`}
                className="inline-flex items-center gap-2 card px-3 py-2 hover:border-moss/40 transition-colors"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-ink"
                  style={{
                    background: s.mp.party
                      ? `linear-gradient(135deg, ${getPartyColor(s.mp.party.abbreviation, s.mp.party.colorNeutral)}18, ${getPartyColor(s.mp.party.abbreviation, s.mp.party.colorNeutral)}38)`
                      : "#EEF1F5",
                  }}
                >
                  {getInitials(s.mp.surname)}
                </div>
                <span className="text-sm text-ink">{s.mp.surname}</span>
                {s.mp.party && (
                  <PartyBadge abbreviation={s.mp.party.abbreviation} colorNeutral={s.mp.party.colorNeutral} size="sm" />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {partyAggregates && partyAggregates.length > 0 && (
        <div className="mb-8">
          <h2 className="font-serif text-[22px] font-normal text-ink mb-4">
            Stemverdeling per partij
          </h2>
          <div className="card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[140px_1fr_60px_60px_60px] gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-sub rounded-t-card">
              <span>Partij</span>
              <span>Verdeling</span>
              <span className="text-right">Voor</span>
              <span className="text-right">Tegen</span>
              <span className="text-right">Afw.</span>
            </div>

            {partyAggregates.map((row, i) => (
              <div
                key={row.abbreviation}
                className={`grid grid-cols-1 sm:grid-cols-[140px_1fr_60px_60px_60px] gap-2 px-5 py-3 items-center table-row-hover ${
                  i < partyAggregates.length - 1 ? "border-b border-border-subtle" : ""
                }`}
              >
                <PartyBadge abbreviation={row.abbreviation} colorNeutral={row.colorNeutral} />
                <div className="pr-4 hidden sm:block">
                  <VoteBar voor={row.voor} tegen={row.tegen} afwezig={row.afwezig} height={7} />
                </div>
                <span className={`hidden sm:block text-right text-[13px] ${row.voor > 0 ? "font-semibold text-ink" : "text-text-tertiary"}`}>
                  {row.voor || "\u2013"}
                </span>
                <span className={`hidden sm:block text-right text-[13px] ${row.tegen > 0 ? "font-semibold text-ink" : "text-text-tertiary"}`}>
                  {row.tegen || "\u2013"}
                </span>
                <span className="hidden sm:block text-right text-[13px] text-text-tertiary">
                  {row.afwezig || "\u2013"}
                </span>
                <div className="flex items-center gap-3 sm:hidden">
                  <div className="flex-1">
                    <VoteBar voor={row.voor} tegen={row.tegen} afwezig={row.afwezig} height={6} />
                  </div>
                  <span className="text-xs text-text-tertiary whitespace-nowrap">
                    {row.voor}&ndash;{row.tegen}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <details className="text-xs text-text-tertiary">
              <summary className="cursor-pointer hover:text-text-secondary underline underline-offset-2">
                Methodologie
              </summary>
              <p className="mt-2 max-w-lg leading-relaxed">
                Stemgegevens afkomstig van de Tweede Kamer OData API (Besluit &rarr;
                Stemming entiteiten).{" "}
                {isHoofdelijk
                  ? "Bij hoofdelijke stemmingen zijn individuele stemmen per Kamerlid beschikbaar. Partijresultaten zijn geaggregeerd op basis van deze individuele stemmen."
                  : "Bij 'met handopsteken' stemmingen zijn alleen partijniveau-resultaten beschikbaar. De aantallen komen overeen met de fractiegrootte ten tijde van de stemming."}
              </p>
            </details>
          </div>
        </div>
      )}

      {isHoofdelijk && hasRecords && vote && (
        <div className="mb-8">
          <h2 className="font-serif text-[22px] font-normal text-ink mb-4">
            Individuele stemmen ({vote.records.length} Kamerleden)
          </h2>
          <div className="card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_120px_100px] gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-sub rounded-t-card">
              <span>Kamerlid</span>
              <span>Partij</span>
              <span className="text-right">Stem</span>
            </div>
            {vote.records
              .sort((a, b) => {
                const order: Record<string, number> = { FOR: 0, AGAINST: 1, ABSTAIN: 2, ABSENT: 3 };
                return (order[a.voteValue] ?? 4) - (order[b.voteValue] ?? 4);
              })
              .map((r, i) => (
                <Link
                  key={r.id}
                  href={`/kamerleden/${r.mp.id}`}
                  className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_100px] gap-2 px-5 py-2.5 items-center table-row-hover ${
                    i < vote.records.length - 1 ? "border-b border-border-subtle" : ""
                  }`}
                >
                  <span className="text-sm text-ink truncate">{r.mp.name}</span>
                  <span className="hidden sm:block">
                    <PartyBadge abbreviation={r.party.abbreviation} colorNeutral={r.party.colorNeutral ?? null} size="sm" />
                  </span>
                  <span className={`text-right text-sm font-medium ${
                    r.voteValue === "FOR" ? "text-ink" :
                    r.voteValue === "AGAINST" ? "text-text-secondary" :
                    "text-text-tertiary"
                  }`}>
                    {voteValueLabel(r.voteValue)}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="font-serif text-[22px] font-normal text-ink mb-4">
          Volledige tekst
        </h2>
        <div className="card p-5">
          <p className="text-sm leading-[1.8] text-text-secondary max-w-[68ch]">
            {m.text}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-[22px] font-normal text-ink mb-4">
          Bronnen &amp; data-integriteit
        </h2>
        <div className="card p-5">
          <div className="space-y-3">
            <SourceRow label="Tweede Kamer OData API" type="Primaire bron" url="gegevensmagazijn.tweedekamer.nl" />
            {m.tkNumber && (
              <SourceRow label={`Kamerstuk ${m.tkNumber}`} type="Document" url="tweedekamer.nl/kamerstukken" />
            )}
            <div className="border-t border-border-subtle pt-3 mt-1">
              <div className="text-[11px] text-text-tertiary">
                Bron-URL: {m.sourceUrl}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function voteValueLabel(value: string): string {
  switch (value) {
    case "FOR": return "Voor";
    case "AGAINST": return "Tegen";
    case "ABSTAIN": return "Onthouden";
    case "ABSENT": return "Afwezig";
    default: return value;
  }
}

function SourceRow({ label, type, url }: { label: string; type: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-moss bg-accent-subtle px-1.5 py-0.5 rounded uppercase tracking-wide">
          VERIFIED
        </span>
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-xs text-text-tertiary">&middot; {type}</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-blue-600">
        {url}
        <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
    </div>
  );
}

interface PartyAggregate {
  abbreviation: string;
  colorNeutral: string | null;
  voor: number;
  tegen: number;
  afwezig: number;
  total: number;
}

function aggregateByPartyFromRecords(records: VoteRecord[]): PartyAggregate[] {
  const map = new Map<string, PartyAggregate>();
  for (const r of records) {
    const key = r.party.abbreviation;
    if (!map.has(key)) {
      map.set(key, { abbreviation: key, colorNeutral: r.party.colorNeutral ?? null, voor: 0, tegen: 0, afwezig: 0, total: 0 });
    }
    const agg = map.get(key)!;
    agg.total++;
    if (r.voteValue === "FOR") agg.voor++;
    else if (r.voteValue === "AGAINST") agg.tegen++;
    else agg.afwezig++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function aggregateByPartyFromRaw(stemmingen: RawStemming[]): PartyAggregate[] {
  const map = new Map<string, PartyAggregate>();
  for (const s of stemmingen) {
    const key = s.ActorNaam;
    const size = s.FractieGrootte || 0;
    const soort = s.Soort?.toLowerCase() || "";
    if (!map.has(key)) {
      map.set(key, { abbreviation: key, colorNeutral: null, voor: 0, tegen: 0, afwezig: 0, total: size });
    }
    const agg = map.get(key)!;
    if (soort === "voor") agg.voor = size;
    else if (soort === "tegen") agg.tegen = size;
    else agg.afwezig = size;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
