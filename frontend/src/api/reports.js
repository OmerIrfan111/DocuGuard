import api from './axiosInstance';

export const generateReport = (documentId, format = 'pdf') =>
  api.post(`/reports/generate/${documentId}`, null, { params: { format } }).then((r) => r.data);

// Download the generated report as a blob (authenticated via interceptor).
export const downloadReport = (documentId) =>
  api.get(`/reports/${documentId}/download`, { responseType: 'blob' }).then((r) => r.data);
