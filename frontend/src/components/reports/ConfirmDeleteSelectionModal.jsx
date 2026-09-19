import { useEffect, useId } from 'react';

const ConfirmDeleteSelectionModal = ({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  busy,
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-admin-ink/40 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md border border-admin-line bg-admin-panel p-5 shadow-admin"
      >
        <h3 id={titleId} className="text-base font-semibold text-admin-ink">
          {title}
        </h3>
        <p className="mt-2 text-sm text-admin-muted">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="admin-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="admin-btn-danger"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteSelectionModal;
