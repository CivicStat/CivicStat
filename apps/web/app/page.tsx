import Link from "next/link";
import { getMotions } from "../lib/api";
import { formatDate } from "../lib/utils";
import PartyBadge from "../components/PartyBadge";
import StatusBadge from "../components/StatusBadge";
import VoteBar from "../components/VoteBar";
import SearchBar from "../components/SearchBar";

export default async function HomePage() {
  let recentMotions;
  try {
    const data = await getMotions({ limit: 5 });
    recentMotions = data.items;
  } catch {
    recentMotions = null;
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1621944190310-e3cca1564bd7?w=1600&q=80&auto=format&fit=crop)",
            filter: "saturate(0.6) contrast(1.05)",
            backgroundPosition: "center 35%",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-mist/30 via-mist/75 to-mist" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-6 pt-[72px] pb-16">
          <p className="text-[13px] font-medium text-moss tracking-wide mb-4">
            Onafhankelijke transparantie over politiek handelen
          </p>
          <h1 className="font-serif text-[clamp(30px,5vw,48px)] font-normal text-ink leading-[1.18] tracking-tight max-w-[640px] mb-5">
            Wat beloven partijen v&oacute;&oacute;r verkiezingen — en hoe stemmen zij{" "}
            <span className="italic">daarna?</span>
          </h1>
          <p className="text-base leading-relaxed text-text-secondary max-w-[500px] mb-8">
            CivicStat maakt het zichtbaar.
            <br />
            Feitelijk. Controleerbaar. Open.
          </p>
          <div className="flex gap-2.5 flex-wrap mb-8">
            <Link
              href="/partijen"
              className="inline-flex items-center gap-2 rounded-[9px] bg-moss px-5 py-2.5 text-sm font-medium text-white hover:bg-moss-hover transition-colors"
            >
              Bekijk partijen
            </Link>
            <Link
              href="/moties"
              className="inline-flex items-center gap-2 rounded-[9px] border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-sub transition-colors"
            >
              Vergelijk stemgedrag
            </Link>
          </div>
          <SearchBar />
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-6">
        {/* Why section */}
        <section className="py-14 border-b border-border-subtle">
          <h2 className="font-serif text-[clamp(24px,3.5vw,34px)] font-normal text-ink max-w-[560px] leading-[1.25] mb-5">
            Verkiezingsprogramma&apos;s zijn openbaar.
            <br />
            Stemgedrag is openbaar.
            <br />
            <span className="italic text-text-secondary">
              Maar de vertaalslag ontbreekt.
            </span>
          </h2>
          <p className="text-[15px] leading-relaxed text-text-secondary max-w-[540px] mb-6">
            CivicStat legt die verbinding — structureel, reproduceerbaar en
            zonder politieke agenda. Wij analyseren verkiezingsprogramma&apos;s,
            Kamerstemmen, moties en wetsvoorstellen.
          </p>
          <p className="text-[15px] font-medium text-ink max-w-[400px]">
            Niet op gevoel. Niet op framing. Op data.
          </p>
        </section>

        {/* Features */}
        <section className="py-12 border-b border-border-subtle">
          <div className="section-label">Wat CivicStat laat zien</div>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            {[
              {
                title: "Belofte \u2192 Stemgedrag",
                desc: "Per partij, per thema: wat is beloofd? Wat is gesteund, verworpen of genegeerd?",
              },
              {
                title: "Scores zonder oordeel",
                desc: "Consistentiescores, afwijkingspercentages en stemfrequenties. Geen moreel oordeel.",
              },
              {
                title: "Individuele volksvertegenwoordigers",
                desc: "Niet alleen partijen, maar ook individuele Kamerleden. Wie stemt consequent?",
              },
            ].map((f, i) => (
              <div key={i} className="card p-6">
                <h3 className="font-serif text-lg text-ink mb-2">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent motions */}
      <div className="bg-surface-sub border-t border-border mt-12 px-6 py-12 pb-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-serif text-[22px] font-normal text-ink">
              Laatste stemmingen
            </h2>
            <Link
              href="/moties"
              className="text-[13px] font-medium text-moss hover:text-moss-hover transition-colors inline-flex items-center gap-1"
            >
              Alle moties &rarr;
            </Link>
          </div>

          {recentMotions ? (
            <div className="card overflow-hidden">
              {recentMotions.map((m, i) => {
                const vote = m.vote || m.votes?.[0];
                const party = m.sponsors?.[0]?.mp?.party;

                return (
                  <Link
                    key={m.id}
                    href={`/moties/${m.id}`}
                    className={`flex items-center gap-4 px-5 py-3.5 table-row-hover ${
                      i < recentMotions.length - 1
                        ? "border-b border-border-subtle"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">
                        {m.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
                        <span>{formatDate(m.dateIntroduced)}</span>
                        {party && (
                          <>
                            <span>&middot;</span>
                            <PartyBadge
                              abbreviation={party.abbreviation}
                              colorNeutral={party.colorNeutral}
                              size="sm"
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-3">
                      {vote && (
                        <div className="w-20 hidden sm:block">
                          <VoteBar
                            voor={vote.totalFor}
                            tegen={vote.totalAgainst}
                            height={6}
                          />
                        </div>
                      )}
                      <StatusBadge status={m.status} size="sm" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="card p-6 text-sm text-text-tertiary">
              Kon de laatste stemmingen niet laden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
