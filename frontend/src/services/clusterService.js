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

export const mergeClusters = async ({
  sourceClusterId,
  targetClusterId,
  clusterIds,
}) => {
  const body = Array.isArray(clusterIds) && clusterIds.length >= 2
    ? { clusterIds }
    : { sourceClusterId, targetClusterId };
  const { data } = await api.post('/admin/merge-clusters', body);
  return data.data;
};

export const deleteClusters = async (clusterIds) => {
  const { data } = await api.post('/admin/delete-clusters', { clusterIds });
  return data.data;
};
