'use client';

export default function ConfirmDialog({
  open,
  title = 'Подтверждение',
  message = 'Подтвердите действие.',
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-lapka-900/40 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-md p-5 shadow-float">
        <h3 className="text-2xl font-extrabold tracking-tight text-lapka-900">{title}</h3>
        <p className="mt-2 text-sm text-lapka-700">{message}</p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Выполняем...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
