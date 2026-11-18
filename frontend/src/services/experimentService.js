import api from './api.js';
import { downloadBlob } from './reportService.js';

export const experimentsQueryKey = (params = {}) => ['admin', 'experiments', params];
export const experimentDetailQueryKey = (id) => ['admin', 'experiments', 'detail', id];
export const experimentTrialsQueryKey = (id, params = {}) => [
  'admin',
  'experiments',
  id,
  'trials',
  params,
];

export const fetchExperiments = async (params = {}) => {
  const { data } = await api.get('/admin/experiments', { params });
  return data.data;
};

export const fetchExperiment = async (experimentId) => {
  const { data } = await api.get(
    `/admin/experiments/${encodeURIComponent(experimentId)}`
  );
  return data.data;
};

export const fetchExperimentTrials = async (experimentId, params = {}) => {
  const { data } = await api.get(
    `/admin/experiments/${encodeURIComponent(experimentId)}/trials`,
    { params }
  );
  return data.data;
};

export const deleteExperiment = async (experimentId) => {
  const { data } = await api.delete(
    `/admin/experiments/${encodeURIComponent(experimentId)}`
  );
  return data.data;
};

export const downloadExperimentPdf = async (experimentId) => {
  const res = await api.get(
    `/admin/experiments/${encodeURIComponent(experimentId)}/report`,
    { responseType: 'blob' }
  );
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `EmergencyDTN_Experiment_Report_${date}.pdf`;
  downloadBlob(blob, filename);
  return { blob, filename };
};

export const downloadAllExperimentsPdf = async () => {
  const res = await api.get('/admin/experiments/report-all', { responseType: 'blob' });
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `EmergencyDTN_All_Experiments_${date}.pdf`;
  downloadBlob(blob, filename);
  return { blob, filename };
};
