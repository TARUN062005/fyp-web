import { useEffect, useId } from 'react';

/**
 * Explicit confirmation before deleting a cloud emergency report.
 * Mesh copies on phones are not retracted.
 */
const ConfirmDeleteReportModal = ({ report, onCancel, onConfirm, busy }) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  if (!report) return null;

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
          Delete this emergency report?
        </h3>
        <p className="mt-2 text-sm text-admin-muted">
          This removes the cloud copy of{' '}
          <span className="font-mono text-admin-ink">
            {report.messageId || report.id}
          </span>{' '}
          from the admin map, reports list, and its cluster. Phones that already
          received the mesh broadcast keep their local copy.
        </p>

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
            onClick={() => onConfirm(report)}
            className="admin-btn-danger"
          >
            {busy ? 'Deleting…' : 'Delete report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteReportModal;
