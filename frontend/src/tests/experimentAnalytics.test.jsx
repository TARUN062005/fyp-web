import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExperimentAnalyticsPage from '../pages/ExperimentAnalyticsPage.jsx';
import ExperimentDetailPage from '../pages/ExperimentDetailPage.jsx';
import { adminNavItems } from '../layouts/AdminLayout.jsx';
import { useAuthStore } from '../store/authStore.js';
import App from '../App.jsx';

vi.mock('../hooks/useAdminSocket.js', () => ({
  useAdminSocketApi: () => ({
    connected: true,
    connectionKey: 1,
    subscribeRadar: vi.fn(),
    unsubscribeRadar: vi.fn(),
    getSocket: () => ({ on: vi.fn(), off: vi.fn() }),
  }),
  AdminSocketProvider: ({ children }) => children,
  useAdminSocket: () => {},
}));

vi.mock('../services/experimentService.js', () => ({
  experimentsQueryKey: (params) => ['admin', 'experiments', params],
  experimentDetailQueryKey: (id) => ['admin', 'experiments', 'detail', id],
  experimentTrialsQueryKey: (id, params) => ['admin', 'experiments', id, 'trials', params],
  fetchExperiments: vi.fn(),
  fetchExperiment: vi.fn(),
  fetchExperimentTrials: vi.fn(),
  downloadExperimentPdf: vi.fn(),
  deleteExperiment: vi.fn(),
}));

import {
  fetchExperiments,
  fetchExperiment,
  fetchExperimentTrials,
} from '../services/experimentService.js';

const wrapper = (ui, path = '/experiments') => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Experiment Analytics', () => {
  beforeEach(() => {
    fetchExperiments.mockReset();
    fetchExperiment.mockReset();
    fetchExperimentTrials.mockReset();
  });

  it('includes Experiment Analytics in the admin nav and route', () => {
    expect(adminNavItems.some((i) => i.to === '/experiments')).toBe(true);
    useAuthStore.setState({
      status: 'ready',
      accessToken: 'a',
      refreshToken: 'r',
      admin: { email: 'admin@test.local', role: 'admin' },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    fetchExperiments.mockResolvedValue({ items: [], total: 0 });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/experiments']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getAllByText('Experiment Analytics').length).toBeGreaterThan(0);
  });

  it('shows an empty state when no physical experiments exist', async () => {
    fetchExperiments.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    wrapper(<ExperimentAnalyticsPage />);
    expect(
      await screen.findByText(/No physical-device experiments uploaded yet/i)
    ).toBeTruthy();
    expect(screen.queryByText('SIMULATION')).toBeNull();
  });

  it('renders backend metrics and PDF button for an experiment', async () => {
    fetchExperiment.mockResolvedValue({
      experiment: {
        experimentId: 'exp-1',
        name: 'Lab run',
        scenario: 'DIRECT_BROADCAST',
        measurementKind: 'PHYSICAL_ANDROID',
        status: 'COMPLETED',
      },
      devices: [
        {
          experimentId: 'exp-1',
          deviceId: 'd1',
          role: 'SENDER',
          model: 'Pixel 7',
          meshUserId: 'mesh-a',
        },
      ],
      summary: {
        deliveryRatio: 100,
        averageLatencyMs: 180,
        medianLatencyMs: 180,
        averageHopCount: 1,
        duplicateSuppressionCount: 0,
        forwardingAttempts: 1,
        routingOverhead: 1,
        cloudRelaySuccessRate: null,
        successfulDeliveries: 1,
        failedTrialCount: 0,
        totalTrialCount: 1,
      },
      byScenario: {
        DIRECT_BROADCAST: { deliveryRatio: 100, averageLatencyMs: 180 },
      },
    });
    fetchExperimentTrials.mockResolvedValue({
      items: [
        {
          trialId: 'trial-abcdef12',
          scenario: 'DIRECT_BROADCAST',
          senderDeviceId: 'd1',
          destinationDeviceId: 'd2',
          delivered: true,
          latencyReliable: true,
          latencyMs: 180,
          hopCount: 1,
          duplicateCount: 0,
          forwardingAttempts: 1,
          cloudUploadStatus: 'NOT_ATTEMPTED',
        },
      ],
      total: 1,
    });
    wrapper(
      <Routes>
        <Route path="/experiments/:experimentId" element={<ExperimentDetailPage />} />
      </Routes>,
      '/experiments/exp-1'
    );
    expect(await screen.findByText('Lab run')).toBeTruthy();
    expect(screen.getByText('Download PDF Report')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeTruthy();
    expect(screen.getByText('PHYSICAL_ANDROID · not simulation')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.queryByText('secret hello')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByRole('dialog', { name: /delete this experiment/i })).toBeTruthy();
  });
});
