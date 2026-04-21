export default function Timeline({ items = [] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={`${item.time}-${item.text}`} className="grid gap-2 sm:grid-cols-[96px_1fr]">
          <span className="text-xs font-semibold uppercase tracking-wide text-lapka-500">{item.time}</span>
          <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">{item.text}</div>
        </li>
      ))}
    </ol>
  );
}
