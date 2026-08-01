import api from './api.js';

export const auditLogsQueryKey = (params = {}) => [
  'admin',
  'audit-logs',
  params,
];

export const fetchAuditLogs = async ({
  page = 1,
  limit = 20,
  action,
  adminId,
} = {}) => {
  const params = { page, limit };
  if (action) params.action = action;
  if (adminId) params.adminId = adminId;
  const { data } = await api.get('/admin/audit-logs', { params });
  return data.data;
};
