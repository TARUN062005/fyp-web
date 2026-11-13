import { useEffect, useId } from 'react';

const ConfirmDeleteExperimentModal = ({ experiment, onCancel, onConfirm, busy }) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  if (!experiment) return null;

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
          Delete this experiment?
        </h3>
        <p className="mt-2 text-sm text-admin-muted">
          This permanently removes{' '}
          <span className="font-medium text-admin-ink">
            {experiment.name || 'this experiment'}
          </span>{' '}
          and its uploaded trials from Experiment Analytics. Phones keep local
          copies until you delete them in Experiment Testing.
        </p>
        <p className="mt-2 font-mono text-xs text-admin-muted">
          {experiment.experimentId}
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
            onClick={() => onConfirm(experiment)}
            className="admin-btn-danger"
          >
            {busy ? 'Deleting…' : 'Delete experiment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteExperimentModal;
