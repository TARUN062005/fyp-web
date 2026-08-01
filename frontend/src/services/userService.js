import api from './api.js';

export const usersQueryKey = (params = {}) => ['admin', 'users', params];

export const fetchUsers = async ({
  page = 1,
  limit = 50,
  filter = 'all',
  q = '',
} = {}) => {
  const params = { page, limit };
  if (filter === 'verified') params.isVerified = true;
  if (filter === 'blocked') params.isBlocked = true;
  if (q.trim()) params.q = q.trim();

  const { data } = await api.get('/admin/users', { params });
  return data.data;
};

export const blockUser = async ({ userId, reason }) => {
  const { data } = await api.post('/admin/block-user', {
    userId,
    ...(reason ? { reason } : {}),
  });
  return data.data;
};

export const unblockUser = async ({ userId }) => {
  const { data } = await api.post('/admin/unblock-user', { userId });
  return data.data;
};
