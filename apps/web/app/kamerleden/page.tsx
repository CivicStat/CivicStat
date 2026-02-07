import Link from "next/link";
import { getMembers } from "../../lib/api";
import { getInitials, getPartyColor } from "../../lib/utils";
import PartyBadge from "../../components/PartyBadge";

export const metadata = { title: "Kamerleden — CivicStat" };

export default async function KamerledenPage() {
  let members;
  try {
    members = await getMembers();
  } catch {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
        <h1 className="font-serif text-[26px] text-ink mb-2">Kamerleden</h1>
        <div className="card p-6 text-sm text-text-secondary">
          Kon geen verbinding maken met de API.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
      <h1 className="font-serif text-[26px] font-normal text-ink mb-1.5">
        Kamerleden
      </h1>
      <p className="text-sm text-text-secondary leading-relaxed mb-6">
        {members.length} actieve Tweede Kamerleden met partijlidmaatschap.
      </p>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const color = getPartyColor(m.party.abbreviation, m.party.colorNeutral);
          return (
            <Link key={m.id} href={`/kamerleden/${m.id}`} className="card p-[18px] hover:border-moss/40 transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-ink flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${color}18, ${color}38)`,
                    border: `2px solid ${color}33`,
                  }}
                >
                  {getInitials(m.surname)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">
                    {m.prefix ? `${m.name} ${m.prefix} ${m.surname}` : `${m.name} ${m.surname}`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <PartyBadge abbreviation={m.party.abbreviation} colorNeutral={m.party.colorNeutral} size="sm" />
                    {(m._count?.sponsors > 0 || m._count?.voteRecords > 0) && (
                      <span className="text-[11px] text-text-tertiary">
                        {m._count.sponsors > 0 ? `${m._count.sponsors} moties` : ""}
                        {m._count.sponsors > 0 && m._count.voteRecords > 0 ? " · " : ""}
                        {m._count.voteRecords > 0 ? `${m._count.voteRecords} stemmen` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
