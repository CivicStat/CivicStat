export default function PageShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <span className="badge">Neutraal en bronbaar</span>
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="text-slate">{subtitle}</p> : null}
      </header>
      <section className="container-card space-y-3 text-sm text-slate">
        {children}
      </section>
    </main>
  );
}
