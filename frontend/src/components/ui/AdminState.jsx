export const ErrorAlert = ({ error, fallback = 'Something went wrong' }) => (
  <p className="mt-4 text-sm text-admin-danger" role="alert">
    {error?.response?.data?.error?.message || error?.message || fallback}
  </p>
);

export const LoadingNotice = ({ children = 'Loading…' }) => (
  <p className="mt-4 text-sm text-admin-muted" aria-live="polite">
    {children}
  </p>
);

export const EmptyNotice = ({ children }) => (
  <p className="mt-4 text-sm text-admin-muted">{children}</p>
);

export const SeverityBadge = ({ severity }) => {
  const level = String(severity || 'MEDIUM').toUpperCase();
  const mark = level[0] || '?';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-sm font-mono text-[10px] font-semibold text-admin-surface"
        style={{ backgroundColor: `var(--severity-${level.toLowerCase()})` }}
        aria-hidden
      >
        {mark}
      </span>
      <span>{level}</span>
    </span>
  );
};
