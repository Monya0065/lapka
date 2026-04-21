export default function StatusBadge({ status = '', tone = '', compact = false }) {
  const normalized = String(tone || status).toLowerCase();
  const sizeClass = compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  let cls = 'bg-lapka-100 text-lapka-700 border-lapka-200';
  if (['green', 'ok', 'active', 'success', 'стабильно', 'готово', 'confirmed'].some((item) => normalized.includes(item))) {
    cls = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  } else if (['yellow', 'warning', 'pending', 'в работе', 'ожидает', 'monitoring'].some((item) => normalized.includes(item))) {
    cls = 'bg-amber-100 text-amber-700 border-amber-200';
  } else if (['red', 'danger', 'critical', 'cancelled', 'нет доступа'].some((item) => normalized.includes(item))) {
    cls = 'bg-rose-100 text-rose-700 border-rose-200';
  } else if (['info', 'draft'].some((item) => normalized.includes(item))) {
    cls = 'bg-cyan-100 text-cyan-700 border-cyan-200';
  }

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold tracking-wide ${sizeClass} ${cls}`}>
      {status || 'Статус'}
    </span>
  );
}
