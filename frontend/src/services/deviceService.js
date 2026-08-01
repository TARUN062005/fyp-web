import api from './api.js';

export const devicesQueryKey = (params = {}) => ['admin', 'devices', params];

export const fetchDevices = async ({
  page = 1,
  limit = 50,
  status = '',
  online = '',
  sort = '-lastSeenAt',
} = {}) => {
  const params = { page, limit, sort };
  if (status) params.status = status;
  if (online === 'online') params.online = true;
  if (online === 'offline') params.online = false;

  const { data } = await api.get('/admin/devices', { params });
  return data.data;
};
