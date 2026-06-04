import api from './axiosInstance';

export const getStats = () => api.get('/documents/stats').then((r) => r.data);

export const listDocuments = (params = {}) =>
  api.get('/documents', { params }).then((r) => r.data);

export const getDocument = (id) => api.get(`/documents/${id}`).then((r) => r.data);

export const getDocumentStatus = (id) =>
  api.get(`/documents/${id}/status`).then((r) => r.data);

export const uploadDocuments = (files, checklistId, onProgress) => {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  form.append('checklist_id', checklistId);
  return api
    .post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded / (e.total || 1)) * 100)),
    })
    .then((r) => r.data);
};

export const approveDocument = (id) => api.patch(`/documents/${id}/approve`).then((r) => r.data);
export const rejectDocument = (id, reason) =>
  api.patch(`/documents/${id}/reject`, { reason }).then((r) => r.data);
export const deleteDocument = (id) => api.delete(`/documents/${id}`).then((r) => r.data);

export const documentFileUrl = (id) => `/documents/${id}/file`;
// Fetch the original file as a blob (carries the JWT via the axios interceptor).
export const fetchDocumentBlob = (id) =>
  api.get(`/documents/${id}/file`, { responseType: 'blob' }).then((r) => r.data);
