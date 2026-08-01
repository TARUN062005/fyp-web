import { AdminSocketEvents } from './dashboardSocketPatches.js';

const upsertCluster = (clusters, cluster) => {
  if (!cluster?.id && !cluster?.clusterId) return clusters;
  const list = Array.isArray(clusters) ? [...clusters] : [];
  const idx = list.findIndex(
    (c) =>
      (cluster.id && c.id === cluster.id) ||
      (cluster.clusterId && c.clusterId === cluster.clusterId)
  );
  if (idx === -1) {
    list.push(cluster);
    return list;
  }
  list[idx] = { ...list[idx], ...cluster };
  return list;
};

const removeCluster = (clusters, clusterId) => {
  if (!Array.isArray(clusters) || !clusterId) return clusters;
  return clusters.filter(
    (c) => c.clusterId !== clusterId && c.id !== clusterId
  );
};

/**
 * Live-update the GET /clusters React Query cache from admin socket events.
 */
export const applyClustersSocketEvent = (clusters, event, payload) => {
  if (clusters == null) return clusters;

  switch (event) {
    case AdminSocketEvents.CLUSTER_CREATED:
      return upsertCluster(clusters, payload?.cluster);

    case AdminSocketEvents.CLUSTER_UPDATED:
      return upsertCluster(clusters, payload?.cluster);

    case AdminSocketEvents.CLUSTER_VERIFIED:
      return upsertCluster(clusters, payload?.cluster);

    case AdminSocketEvents.CLUSTER_MERGED: {
      let next = upsertCluster(clusters, payload?.cluster);
      if (payload?.mergedAwayClusterId) {
        next = removeCluster(next, payload.mergedAwayClusterId);
      }
      return next;
    }

    default:
      return clusters;
  }
};
