import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportsPage from '../pages/ReportsPage.jsx';

vi.mock('../hooks/useReports.js', () => ({
  useReports: () => ({
    data: {
      reports: [
        {
          id: 'r1',
          messageId: 'msg-sos-1',
          emergencyType: 'sos',
          severity: 'CRITICAL',
          verificationStatus: 'UNVERIFIED',
          uploadCount: 1,
          hopCount: 0,
          timestamp: '2026-01-01T00:00:00.000Z',
          originalSenderId: 'u1',
        },
      ],
      total: 1,
      totalPages: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
  }),
}));

const mutateAsync = vi.fn();

vi.mock('../hooks/useReportMutations.js', () => ({
  useDeleteReport: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock('../services/reportService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exportReports: vi.fn(),
    downloadBlob: vi.fn(),
  };
});

describe('ReportsPage delete', () => {
  it('opens a confirm dialog then deletes the report', async () => {
    mutateAsync.mockResolvedValue({ reportId: 'r1', messageId: 'msg-sos-1' });
    render(<ReportsPage />);

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByRole('dialog', { name: /delete this emergency report/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /delete report/i }));
    expect(mutateAsync).toHaveBeenCalledWith('r1');
  });
});
