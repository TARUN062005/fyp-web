import api from './api.js';

export const radarGatewaysQueryKey = ['admin', 'radar', 'gateways'];

export const radarGatewayQueryKey = (gatewayUserId) => [
  'admin',
  'radar',
  'gateway',
  gatewayUserId,
];

export const fetchRadarGateways = async () => {
  const { data } = await api.get('/admin/radar/gateways');
  return data.data;
};

export const fetchRadarGateway = async (gatewayUserId) => {
  const { data } = await api.get(`/admin/radar/gateways/${gatewayUserId}`);
  return data.data;
};
