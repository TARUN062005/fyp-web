import api from './api.js';

export const analyticsQueryKey = (days = 14) => ['admin', 'analytics', { days }];

export const fetchAnalytics = async (days = 14) => {
  const { data } = await api.get('/admin/analytics', {
    params: { days },
  });
  return data.data;
};
