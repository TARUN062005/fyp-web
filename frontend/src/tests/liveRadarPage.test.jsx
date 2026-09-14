import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LiveRadarPage from '../pages/LiveRadarPage.jsx';
import { useAuthStore } from '../store/authStore.js';
import { adminNavItems } from '../layouts/AdminLayout.jsx';
import App from '../App.jsx';

const subscribeRadar = vi.fn();
const unsubscribeRadar = vi.fn();
const handlers = {};

vi.mock('../hooks/useAdminSocket.js', () => ({
  useAdminSocketApi: () => ({
    connected: true,
    connectionKey: 1,
    subscribeRadar,
    unsubscribeRadar,
    getSocket: () => ({
      on: (event, cb) => {
        handlers[event] = cb;
      },
      off: (event) => {
        delete handlers[event];
      },
    }),
  }),
  AdminSocketProvider: ({ children }) => children,
  useAdminSocket: () => {},
}));

vi.mock('../services/radarService.js', () => ({
  radarGatewaysQueryKey: ['admin', 'radar', 'gateways'],
  radarGatewayQueryKey: (id) => ['admin', 'radar', 'gateway', id],
  fetchRadarGateways: vi.fn(),
  fetchRadarGateway: vi.fn(),
}));

import {
  fetchRadarGateways,
  fetchRadarGateway,
} from '../services/radarService.js';

const gatewayC = {
  gatewayUserId: '507f1f77bcf86cd7994390cc',
  displayName: 'User C',
  emergencyId: 'EDTN-CCCCC',
  status: 'LIVE',
  lastUpdatedAt: new Date().toISOString(),
  peerCount: 2,
};

const snapshotC = {
  gatewayUserId: gatewayC.gatewayUserId,
  displayName: 'User C',
  status: 'LIVE',
  lastUpdatedAt: new Date().toISOString(),
  radarRangeMeters: 20,
  angleKind: 'VISUAL_SECTOR',
  peers: [
    {
      peerId: 'peer-a',
      displayName: 'Person A',
      connectionState: 'CONNECTED',
      distanceMeters: 18.4,
      angleDegrees: 12,
      lastSeen: new Date().toISOString(),
    },
  ],
};

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LiveRadarPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Live Radar', () => {
  beforeEach(() => {
    subscribeRadar.mockReset();
    unsubscribeRadar.mockReset();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    fetchRadarGateways.mockResolvedValue({ gateways: [gatewayC] });
    fetchRadarGateway.mockResolvedValue(snapshotC);
  });

  it('includes a Live Radar sidebar item and /live-radar route', () => {
    expect(adminNavItems.some((i) => i.to === '/live-radar')).toBe(true);
    useAuthStore.setState({
      status: 'ready',
      accessToken: 'a',
      refreshToken: 'r',
      admin: { email: 'admin@test.local', role: 'admin' },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/live-radar']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getAllByText('Live Radar').length).toBeGreaterThan(0);
  });

  it('lists gateways, selects one, and renders snapshot peers', async () => {
    renderPage();
    expect(await screen.findByText('User C')).toBeInTheDocument();
    fireEvent.click(screen.getByText('User C'));
    await waitFor(() => {
      expect(subscribeRadar).toHaveBeenCalledWith(gatewayC.gatewayUserId);
    });
    expect(await screen.findByText('Person A')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Person A'));
    expect(screen.getByText('Selected node')).toBeInTheDocument();
    expect(screen.getByText(/18.4 m/)).toBeInTheDocument();
  });

  it('applies a socket snapshot for the selected gateway only', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('User C'));
    await waitFor(() => expect(handlers['radar:gateway:updated']).toBeTypeOf('function'));
    handlers['radar:gateway:updated']({
      gatewayUserId: gatewayC.gatewayUserId,
      status: 'LIVE',
      lastUpdatedAt: new Date().toISOString(),
      peers: [
        {
          peerId: 'peer-b',
          displayName: 'Person B',
          connectionState: 'DISCOVERED',
          distanceMeters: 7,
          angleDegrees: -20,
        },
      ],
    });
    expect(await screen.findByText('Person B')).toBeInTheDocument();
    handlers['radar:gateway:updated']({
      gatewayUserId: 'other-gateway',
      peers: [{ peerId: 'x', displayName: 'Ignored', connectionState: 'CONNECTED', distanceMeters: 1, angleDegrees: 0 }],
    });
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
  });

  it('shows STALE from a status event', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('User C'));
    await waitFor(() => expect(handlers['radar:gateway:status']).toBeTypeOf('function'));
    handlers['radar:gateway:status']({
      gatewayUserId: gatewayC.gatewayUserId,
      status: 'STALE',
      lastUpdatedAt: new Date(Date.now() - 25000).toISOString(),
    });
    expect(await screen.findAllByText('STALE')).not.toHaveLength(0);
  });

  it('unsubscribes the previous gateway when switching', async () => {
    fetchRadarGateways.mockResolvedValue({
      gateways: [
        gatewayC,
        { ...gatewayC, gatewayUserId: '507f1f77bcf86cd7994390ff', displayName: 'User F' },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByText('User C'));
    await waitFor(() => expect(subscribeRadar).toHaveBeenCalledWith(gatewayC.gatewayUserId));
    fireEvent.click(screen.getByText('User F'));
    expect(unsubscribeRadar).toHaveBeenCalledWith(gatewayC.gatewayUserId);
    await waitFor(() =>
      expect(subscribeRadar).toHaveBeenCalledWith('507f1f77bcf86cd7994390ff')
    );
  });
});
