export default function ErrorBanner({ message = 'An error occurred', onRetry, retryLabel = 'Retry' }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry ? (
          <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

