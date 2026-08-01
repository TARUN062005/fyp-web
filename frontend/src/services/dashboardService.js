import api from './api.js';

export const DASHBOARD_SUMMARY_QUERY_KEY = ['admin', 'dashboard-summary'];

export const fetchDashboardSummary = async () => {
  const { data } = await api.get('/admin/dashboard-summary');
  return data.data;
};
