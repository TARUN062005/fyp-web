import api from './api.js';

export const clusterReportsQueryKey = (clusterId) => [
  'admin',
  'reports',
  'cluster',
  clusterId,
];

export const reportsQueryKey = (params = {}) => ['admin', 'reports', params];

/** Strip empty values; shared by list + export so filters stay identical. */
export const buildReportParams = ({
  page,
  limit,
  severity,
  emergencyType,
  clusterId,
  from,
  to,
  minLng,
  minLat,
  maxLng,
  maxLat,
  format,
} = {}) => {
  const params = {};
  if (page != null) params.page = page;
  if (limit != null) params.limit = limit;
  if (severity) params.severity = severity;
  if (emergencyType) params.emergencyType = emergencyType;
  if (clusterId) params.clusterId = clusterId;
  if (from) params.from = from;
  if (to) params.to = to;

  const box = [minLng, minLat, maxLng, maxLat];
  const boxFilled = box.every(
    (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))
  );
  if (boxFilled) {
    params.minLng = Number(minLng);
    params.minLat = Number(minLat);
    params.maxLng = Number(maxLng);
    params.maxLat = Number(maxLat);
  }

  if (format) params.format = format;
  return params;
};

export const fetchClusterReports = async (clusterId) => {
  const { data } = await api.get('/admin/reports', {
    params: { clusterId, limit: 100, page: 1 },
  });
  return data.data;
};

export const fetchReports = async (filters = {}) => {
  const params = buildReportParams(filters);
  const { data } = await api.get('/admin/reports', { params });
  return data.data;
};

/**
 * Download export for the current filters (not the unfiltered dataset).
 * Returns { blob, filename, reports? } — reports present for JSON format.
 */
export const exportReports = async (filters = {}, format = 'csv') => {
  const params = buildReportParams({ ...filters, format });
  // page/limit are list-only; export ignores them but drop to avoid confusion
  delete params.page;
  delete params.limit;

  if (format === 'csv') {
    const res = await api.get('/admin/reports/export', {
      params,
      responseType: 'blob',
    });
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
    return {
      blob,
      filename: 'emergency-reports.csv',
      contentType: res.headers['content-type'],
    };
  }

  const { data } = await api.get('/admin/reports/export', { params });
  const reports = data.data?.reports ?? [];
  const blob = new Blob([JSON.stringify({ reports }, null, 2)], {
    type: 'application/json',
  });
  return { blob, filename: 'emergency-reports.json', reports };
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
