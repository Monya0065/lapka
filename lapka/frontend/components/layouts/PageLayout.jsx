export default function PageLayout({
  title,
  critical,
  primary,
  secondary,
  history,
}) {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text">{title}</h1>
      </header>

      {critical ? (
        <section>
          {critical}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {primary}
        </div>
        <aside>
          {secondary}
        </aside>
      </section>

      {history ? (
        <section className="border-t border-border pt-6">
          {history}
        </section>
      ) : null}
    </div>
  );
}
