/**
 * Pure patches applied to the dashboard-summary React Query cache
 * when admin Socket.IO events arrive (no HTTP refetch).
 */

export const AdminSocketEvents = {
  REPORT_CREATED: 'report:created',
  CLUSTER_CREATED: 'cluster:created',
  CLUSTER_UPDATED: 'cluster:updated',
  CLUSTER_VERIFIED: 'cluster:verified',
  CLUSTER_MERGED: 'cluster:merged',
  DEVICE_STATUS: 'device:status',
  USER_BLOCKED: 'user:blocked',
  USER_UNBLOCKED: 'user:unblocked',
};

export const applyDashboardSocketEvent = (summary, event, payload) => {
  if (!summary) return summary;
  const s = { ...summary };
  const now = new Date().toISOString();

  switch (event) {
    case AdminSocketEvents.CLUSTER_CREATED:
      return {
        ...s,
        activeEmergencies: (s.activeEmergencies ?? 0) + 1,
        clustersToday: (s.clustersToday ?? 0) + 1,
        generatedAt: now,
      };
    case AdminSocketEvents.CLUSTER_UPDATED:
    case AdminSocketEvents.REPORT_CREATED:
      return { ...s, generatedAt: now };
    case AdminSocketEvents.CLUSTER_MERGED:
      return {
        ...s,
        activeEmergencies: Math.max((s.activeEmergencies ?? 1) - 1, 0),
        generatedAt: now,
      };
    case AdminSocketEvents.USER_BLOCKED:
      return {
        ...s,
        blockedUsers: (s.blockedUsers ?? 0) + 1,
        generatedAt: now,
      };
    case AdminSocketEvents.USER_UNBLOCKED:
      return {
        ...s,
        blockedUsers: Math.max((s.blockedUsers ?? 1) - 1, 0),
        generatedAt: now,
      };
    case AdminSocketEvents.DEVICE_STATUS: {
      const online = payload?.device?.online;
      const previousOnline = payload?.previousOnline;
      if (online === previousOnline) return s;
      return {
        ...s,
        devicesOnline: Math.max(
          0,
          (s.devicesOnline ?? 0) + (online ? 1 : -1)
        ),
        generatedAt: now,
      };
    }
    default:
      return s;
  }
};
