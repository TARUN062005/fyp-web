import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClustersPage from '../pages/ClustersPage.jsx';

vi.mock('../hooks/useClusters.js', () => ({
  useClustersList: () => ({
    data: [
      {
        id: '1',
        clusterId: 'CLUSTER-SOS1',
        emergencyType: 'sos',
        severity: 'CRITICAL',
        reportCount: 2,
        firstReportAt: '2026-01-01T00:00:00.000Z',
        lastReportAt: '2026-01-01T01:00:00.000Z',
        status: 'unverified',
      },
      {
        id: '2',
        clusterId: 'CLUSTER-FIRE',
        emergencyType: 'fire',
        severity: 'HIGH',
        reportCount: 1,
        firstReportAt: '2026-01-01T00:00:00.000Z',
        lastReportAt: '2026-01-01T00:00:00.000Z',
        status: 'unverified',
      },
      {
        id: '3',
        clusterId: 'CLUSTER-SOS2',
        emergencyType: 'sos',
        severity: 'HIGH',
        reportCount: 1,
        firstReportAt: '2026-01-01T00:00:00.000Z',
        lastReportAt: '2026-01-01T00:00:00.000Z',
        status: 'verified',
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const mergeAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock('../hooks/useClusterMutations.js', () => ({
  useVerifyCluster: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMergeClusters: () => ({ mutateAsync: mergeAsync, isPending: false }),
  useDeleteClusters: () => ({ mutateAsync: deleteAsync, isPending: false }),
}));

vi.mock('../hooks/useClusterReports.js', () => ({
  useClusterReports: () => ({
    data: { reports: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../hooks/useReportMutations.js', () => ({
  useDeleteReport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteReports: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ClustersPage />
    </MemoryRouter>
  );

describe('ClustersPage kinds and bulk actions', () => {
  beforeEach(() => {
    mergeAsync.mockReset();
    deleteAsync.mockReset();
  });

  it('labels SOS separately from broadcast alerts', () => {
    renderPage();
    expect(screen.getAllByText('SOS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Broadcast').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Personal SOS/).length).toBe(2);
    expect(screen.getByText(/fire broadcast/i)).toBeTruthy();
  });

  it('filters to SOS clusters only', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /SOS \(2\)/i }));
    expect(screen.getByText(/CLUSTER-SOS1/)).toBeTruthy();
    expect(screen.getByText(/CLUSTER-SOS2/)).toBeTruthy();
    expect(screen.queryByText(/CLUSTER-FIRE/)).toBeNull();
  });

  it('merges two or more selected clusters of the same kind', async () => {
    mergeAsync.mockResolvedValue({ cluster: { clusterId: 'CLUSTER-SOS1' } });
    renderPage();

    const mergeBtn = screen.getByRole('button', { name: /merge selected/i });
    expect(mergeBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /select CLUSTER-SOS1/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /select CLUSTER-SOS2/i }));
    expect(mergeBtn).not.toBeDisabled();

    fireEvent.click(mergeBtn);
    expect(mergeAsync).toHaveBeenCalledWith({
      clusterIds: ['CLUSTER-SOS1', 'CLUSTER-SOS2'],
    });
  });

  it('blocks a mixed SOS + broadcast merge', () => {
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select CLUSTER-SOS1/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /select CLUSTER-FIRE/i }));
    fireEvent.click(screen.getByRole('button', { name: /merge selected/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/same kind/i);
    expect(mergeAsync).not.toHaveBeenCalled();
  });

  it('opens a group-delete confirm for selected clusters', () => {
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select CLUSTER-SOS1/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /select CLUSTER-FIRE/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete selected/i }));
    expect(screen.getByRole('dialog', { name: /delete 2 clusters/i })).toBeTruthy();
  });
});
