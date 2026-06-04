import api from './axiosInstance';

export const listAuditLogs = (params = {}) =>
  api.get('/audit-logs', { params }).then((r) => r.data);

export const exportAuditLogsBlob = (params = {}) =>
  api.get('/audit-logs/export', { params, responseType: 'blob' }).then((r) => r.data);
