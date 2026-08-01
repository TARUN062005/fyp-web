import { useEffect, useId, useState } from 'react';

/**
 * Explicit confirmation before blocking — not a single-click action.
 * Requires acknowledging impact and typing the Emergency ID.
 */
const ConfirmBlockModal = ({ user, onCancel, onConfirm, busy }) => {
  const titleId = useId();
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  const [typedId, setTypedId] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  if (!user) return null;

  const expected = String(user.emergencyId || '').toUpperCase();
  const typedOk = typedId.trim().toUpperCase() === expected;
  const canSubmit = ack && typedOk && !busy;

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
          Block this user?
        </h3>
        <p className="mt-2 text-sm text-admin-muted">
          Blocking{' '}
          <span className="font-medium text-admin-ink">
            {user.displayName}
          </span>{' '}
          (<span className="font-mono">{user.emergencyId}</span>) stops their
          ability to upload and communicate on the mobile network. This is not
          reversible without an explicit unblock.
        </p>

        <label className="mt-4 block text-xs font-medium text-admin-muted">
          Reason (optional)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={busy}
            className="admin-input mt-1 resize-none"
            placeholder="Why is this account being blocked?"
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-admin-muted">
          Type Emergency ID to confirm
          <input
            value={typedId}
            onChange={(e) => setTypedId(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            placeholder={expected}
            className="admin-input mt-1 font-mono"
          />
        </label>

        <label className="mt-3 flex items-start gap-2 text-sm text-admin-ink">
          <input
            type="checkbox"
            checked={ack}
            disabled={busy}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I understand this blocks a real person from emergency
            communication until they are unblocked.
          </span>
        </label>

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
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                userId: user.id,
                reason: reason.trim() || undefined,
              })
            }
            className="admin-btn-danger"
          >
            {busy ? 'Blocking…' : 'Confirm block'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmBlockModal;
