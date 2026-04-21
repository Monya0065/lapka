export default function StatsCard({ label, value, trend, icon }) {
  return (
    <article className="surface-card group p-5 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-600">{label}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-lapka-900 md:text-[2.35rem]">{value}</p>
          {trend ? <p className="mt-1 text-sm font-medium text-mint-700">{trend}</p> : null}
        </div>
        {icon ? <span className="pill !px-4 !py-2 text-sm">{icon}</span> : null}
      </div>
    </article>
  );
}
