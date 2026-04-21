export default function Alert({ tone = 'info', children }) {
  const map = {
    info: 'border-lapka-200 bg-lapka-50 text-lapka-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700'
  };

  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${map[tone] || map.info}`}>{children}</div>;
}
