import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDeleteReportModal from '../components/reports/ConfirmDeleteReportModal.jsx';

describe('ConfirmDeleteReportModal', () => {
  const report = {
    id: 'r1',
    messageId: 'msg-sos-1',
  };

  it('calls onConfirm with the report when Delete is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteReportModal
        report={report}
        busy={false}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete report/i }));
    expect(onConfirm).toHaveBeenCalledWith(report);
  });

  it('does not confirm while busy', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteReportModal
        report={report}
        busy
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );

    const btn = screen.getByRole('button', { name: /deleting/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
