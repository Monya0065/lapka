export default function Charts({ points = [44, 56, 38, 62, 71, 64, 58], labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] }) {
  const max = Math.max(...points, 1);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {points.map((point, index) => (
        <div key={`${labels[index]}-${point}`} className="rounded-xl border border-lapka-200 bg-white p-2">
          <div className="h-24 rounded-lg bg-lapka-100 p-1">
            <div className="flex h-full items-end">
              <div
                className="w-full rounded-md bg-lapka-gradient transition-all duration-300"
                style={{ height: `${Math.round((point / max) * 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold text-lapka-700">{labels[index]} · {point}</p>
        </div>
      ))}
    </div>
  );
}
