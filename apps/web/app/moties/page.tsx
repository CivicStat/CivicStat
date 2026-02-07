import Link from "next/link";
import { getMotions } from "../../lib/api";
import type { MotionListItem } from "../../lib/types";
import { formatDate } from "../../lib/utils";
import PartyBadge from "../../components/PartyBadge";
import StatusBadge from "../../components/StatusBadge";
import VoteBar from "../../components/VoteBar";
import MotiesFilters from "./MotiesFilters";

interface Props {
  searchParams: {
    status?: string;
    q?: string;
    page?: string;
  };
}

const PAGE_SIZE = 25;

export const metadata = {
  title: "Moties — CivicStat",
};

export default async function MotiesPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  let data;
  try {
    data = await getMotions({
      status: searchParams.status,
      q: searchParams.q,
      limit: PAGE_SIZE,
      offset,
    });
  } catch (err) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
        <h1 className="font-serif text-2xl text-ink mb-2">Moties</h1>
        <div className="card p-6 text-text-secondary text-sm">
          Kon geen verbinding maken met de API. Probeer het later opnieuw.
        </div>
      </div>
    );
  }

  const { items, total } = data;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function getVote(m: MotionListItem) {
    if (m.vote) return m.vote;
    if (m.votes && m.votes.length > 0) return m.votes[0];
    return null;
  }

  function getSponsorParty(m: MotionListItem) {
    const sponsor = m.sponsors?.[0];
    if (sponsor?.mp?.party) return sponsor.mp.party;
    return null;
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-7 pb-24">
      <h1 className="font-serif text-[26px] font-normal text-ink mb-1.5">
        Moties
      </h1>
      <p className="text-sm text-text-secondary leading-relaxed mb-5">
        {total.toLocaleString("nl-NL")} ingediende moties met stemresultaat en
        bronverwijzing.
      </p>

      <MotiesFilters
        currentStatus={searchParams.status}
        currentQ={searchParams.q}
      />

      <div className="card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_100px_80px_100px] gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-sub rounded-t-card">
          <span>Motie</span>
          <span>Datum</span>
          <span>Uitslag</span>
          <span>Status</span>
        </div>

        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-text-tertiary">
            Geen moties gevonden.
          </div>
        )}
        {items.map((m, i) => {
          const vote = getVote(m);
          const party = getSponsorParty(m);

          return (
            <Link
              key={m.id}
              href={`/moties/${m.id}`}
              className={`block sm:grid sm:grid-cols-[1fr_100px_80px_100px] items-center gap-2 px-5 py-3.5 table-row-hover ${
                i < items.length - 1 ? "border-b border-border-subtle" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink truncate">
                  {m.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                  {m.tkNumber && (
                    <>
                      <span>{m.tkNumber}</span>
                      <span>&middot;</span>
                    </>
                  )}
                  {party && (
                    <PartyBadge
                      abbreviation={party.abbreviation}
                      colorNeutral={party.colorNeutral}
                      size="sm"
                    />
                  )}
                </div>
              </div>

              <span className="hidden sm:block text-[13px] text-text-secondary">
                {formatDate(m.dateIntroduced)}
              </span>

              <div className="hidden sm:block w-[60px]">
                {vote ? (
                  <>
                    <VoteBar
                      voor={vote.totalFor}
                      tegen={vote.totalAgainst}
                      height={6}
                    />
                    <div className="mt-0.5 text-[11px] text-text-tertiary">
                      {vote.totalFor}&ndash;{vote.totalAgainst}
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] text-text-tertiary">&ndash;</span>
                )}
              </div>

              <div className="mt-2 sm:mt-0">
                <StatusBadge status={m.status} size="sm" />
              </div>

              <div className="mt-1.5 flex items-center gap-3 sm:hidden text-xs text-text-tertiary">
                <span>{formatDate(m.dateIntroduced)}</span>
                {vote && (
                  <span>
                    {vote.totalFor}&ndash;{vote.totalAgainst}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-text-tertiary text-xs">
            Pagina {page} van {totalPages} ({total.toLocaleString("nl-NL")}{" "}
            moties)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <PaginationLink
                page={page - 1}
                status={searchParams.status}
                q={searchParams.q}
                label="&larr; Vorige"
              />
            )}
            {page < totalPages && (
              <PaginationLink
                page={page + 1}
                status={searchParams.status}
                q={searchParams.q}
                label="Volgende &rarr;"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  status,
  q,
  label,
}: {
  page: number;
  status?: string;
  q?: string;
  label: string;
}) {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  if (status) sp.set("status", status);
  if (q) sp.set("q", q);

  return (
    <Link
      href={`/moties?${sp.toString()}`}
      className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-sub transition-colors"
    >
      {label}
    </Link>
  );
}
