import api from './api.js';

export const CLUSTERS_QUERY_KEY = ['clusters', 'active'];
export const clustersQueryKey = ({ includeResolved = false } = {}) => [
  'clusters',
  includeResolved ? 'all' : 'active',
];

export const fetchClusters = async ({ includeResolved = false } = {}) => {
  const { data } = await api.get('/clusters', {
    params: includeResolved ? { includeResolved: true, limit: 200 } : { limit: 200 },
  });
  return data.data.clusters ?? [];
};

export const verifyCluster = async (clusterId) => {
  const { data } = await api.post('/admin/verify-cluster', { clusterId });
  return data.data;
};

export const mergeClusters = async ({ sourceClusterId, targetClusterId }) => {
  const { data } = await api.post('/admin/merge-clusters', {
    sourceClusterId,
    targetClusterId,
  });
  return data.data;
};
