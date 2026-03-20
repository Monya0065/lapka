export default function EmptyState({
  title = 'Пока пусто',
  text = 'Добавьте первую запись, чтобы увидеть данные.',
  action = null,
}) {
  return (
    <div className="empty-state">
      <p className="text-base font-semibold text-lapka-800">{title}</p>
      <p className="mt-1 text-sm text-lapka-600">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
