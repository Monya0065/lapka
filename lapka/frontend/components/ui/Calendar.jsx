export default function Calendar({ title = 'Март 2026' }) {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-lapka-700">{title}</h4>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day} className="rounded-xl border border-lapka-200 bg-white p-2 text-xs text-lapka-700">
            <p className="font-semibold">{day}</p>
            {day % 6 === 0 ? <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Визит</span> : null}
            {day % 10 === 0 ? <span className="mt-1 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">Вакцина</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
