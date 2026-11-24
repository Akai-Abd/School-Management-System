export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="d-flex align-items-center justify-content-center py-5 text-secondary" role="status">
      <div className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card border-0 shadow-sm text-center py-5 px-3">
      <h2 className="h5 mb-2">{title}</h2>
      <p className="text-muted mb-0">{description}</p>
    </div>
  );
}
