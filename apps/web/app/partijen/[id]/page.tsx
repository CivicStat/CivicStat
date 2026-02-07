import Link from "next/link";
import { getParty } from "../../../lib/api";
import { getPartyColor, getInitials } from "../../../lib/utils";
import VoteBar from "../../../components/VoteBar";

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const party = await getParty(params.id);
    return { title: `${party.abbreviation} — CivicStat` };
  } catch {
    return { title: "Partij — CivicStat" };
  }
}

const SEATS: Record<string, number> = {
  PVV: 37, "GL-PvdA": 25, VVD: 24, NSC: 20, D66: 9, BBB: 7,
  CDA: 5, SP: 5, PvdD: 3, CU: 3, FVD: 3, SGP: 3, DENK: 3,
  Volt: 2, JA21: 1,
};

export default async function PartyDetailPage({ params }: { params: { id: string } }) {
  let party;
  try {
    party = await getParty(params.id);
  } catch {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
        <Link href="/partijen" className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-ink mb-5">
          <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Terug naar partijen
        </Link>
        <div className="card p-6 text-sm text-text-secondary">Kon deze partij niet laden.</div>
      </div>
    );
  }

  const color = getPartyColor(party.abbreviation, party.colorNeutral);
  const seats = SEATS[party.abbreviation] || 0;
  const activeMps = party.mps?.filter((m: any) => !m.endDate) || [];
  const vs = party.voteStats;

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
      <Link href="/partijen" className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-ink mb-6">
        <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Terug naar partijen
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl text-base font-extrabold shrink-0"
          style={{ backgroundColor: `${color}18`, border: `2px solid ${color}40`, color }}
        >
          {party.abbreviation.slice(0, 3)}
        </div>
        <div>
          <h1 className="font-serif text-[clamp(26px,4vw,34px)] text-ink leading-tight">
            {party.abbreviation}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{party.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {seats > 0 && (
          <div className="card p-4">
            <div className="section-label">Zetels</div>
            <div className="text-2xl font-serif text-ink">{seats}</div>
          </div>
        )}
        <div className="card p-4">
          <div className="section-label">Actieve leden</div>
          <div className="text-2xl font-serif text-ink">{activeMps.length}</div>
        </div>
        {vs && vs.totalVotes > 0 && (
          <>
            <div className="card p-4">
              <div className="section-label">Stemmingen</div>
              <div className="text-2xl font-serif text-ink">{vs.totalVotes}</div>
            </div>
            <div className="card p-4">
              <div className="section-label">Gewonnen</div>
              <div className="text-2xl font-serif text-ink">
                {vs.votesWon != null ? `${Math.round((vs.votesWon / vs.totalVotes) * 100)}%` : "\u2013"}
              </div>
            </div>
          </>
        )}
        {party.startDate && (
          <div className="card p-4">
            <div className="section-label">Opgericht</div>
            <div className="text-lg font-serif text-ink">{new Date(party.startDate).getFullYear()}</div>
          </div>
        )}
      </div>

      {vs && vs.totalVotes > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-xl text-ink mb-4">Stempatroon</h2>
          <div className="card p-5">
            <VoteBar voor={vs.for} tegen={vs.against} afwezig={vs.abstain || 0} height={12} showLabels />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
              <div>
                <span className="text-text-tertiary text-xs">Voor</span>
                <div className="text-ink font-semibold">{vs.for} ({Math.round((vs.for / vs.totalVotes) * 100)}%)</div>
              </div>
              <div>
                <span className="text-text-tertiary text-xs">Tegen</span>
                <div className="text-ink font-semibold">{vs.against} ({Math.round((vs.against / vs.totalVotes) * 100)}%)</div>
              </div>
              <div>
                <span className="text-text-tertiary text-xs">Onthouden</span>
                <div className="text-ink font-semibold">{vs.abstain || 0}</div>
              </div>
              {vs.votesWon != null && (
                <div>
                  <span className="text-text-tertiary text-xs">Winnende kant</span>
                  <div className="text-ink font-semibold">{vs.votesWon} van {vs.totalVotes}</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeMps.length > 0 && (
        <section>
          <h2 className="font-serif text-xl text-ink mb-4">Kamerleden ({activeMps.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeMps.sort((a: any, b: any) => a.surname.localeCompare(b.surname)).map((mp: any) => (
              <Link key={mp.id} href={`/kamerleden/${mp.id}`} className="card p-4 hover:border-moss/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold text-ink shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${color}18, ${color}38)`,
                      border: `2px solid ${color}33`,
                    }}
                  >
                    {getInitials(mp.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{mp.surname}</div>
                    <div className="text-[11px] text-text-tertiary truncate">{mp.name}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
