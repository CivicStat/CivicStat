export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-10">
      <header className="flex flex-col gap-6">
        <span className="badge">Feitelijk, transparant, auditbaar</span>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Neutrale ontsluiting van moties, stemgedrag en programmapassages.
          </h1>
          <p className="text-lg text-slate">
            Dit platform maakt parlementaire informatie begrijpelijk en herleidbaar.
            Alle data is traceerbaar, versieerbaar en voorzien van bronnen.
          </p>
        </div>
        <div className="container-card flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Zoek moties, stemmingen of Kamerleden"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none ring-moss/40 focus:ring-2"
          />
          <button className="rounded-xl bg-moss px-5 py-3 text-sm font-semibold text-white">
            Zoeken
          </button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="container-card">
          <p className="text-xs uppercase tracking-wide text-slate">Nieuwste moties</p>
          <p className="mt-3 text-3xl font-semibold">Dagelijks bijgewerkt</p>
          <p className="mt-2 text-sm text-slate">
            Ingest van officiële bronnen met audit trail en raw payloads.
          </p>
        </div>
        <div className="container-card">
          <p className="text-xs uppercase tracking-wide text-slate">Stemgedrag</p>
          <p className="mt-3 text-3xl font-semibold">Per Kamerlid en fractie</p>
          <p className="mt-2 text-sm text-slate">
            Geen rankings of labels. Alleen feitelijke uitkomsten en context.
          </p>
        </div>
        <div className="container-card">
          <p className="text-xs uppercase tracking-wide text-slate">Wat verbindt ons?</p>
          <p className="mt-3 text-3xl font-semibold">Consensus in cijfers</p>
          <p className="mt-2 text-sm text-slate">
            Statistiek op basis van stemdata, met uitleg en beperkingen.
          </p>
        </div>
      </section>

      <section className="container-card space-y-3">
        <h2 className="text-2xl font-semibold">Navigatie (MVP)</h2>
        <div className="grid gap-2 text-sm text-slate sm:grid-cols-2">
          <a className="underline" href="/travel-planner">/travel-planner</a>
          <a className="underline" href="/moties">/moties</a>
          <a className="underline" href="/kamerleden">/kamerleden</a>
          <a className="underline" href="/partijen">/partijen</a>
          <a className="underline" href="/verbinding">/verbinding</a>
          <a className="underline" href="/transparantie">/transparantie</a>
          <a className="underline" href="/api">/api</a>
        </div>
      </section>
    </main>
  );
}
