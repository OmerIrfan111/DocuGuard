import api from './axiosInstance';

export const listChecklists = () => api.get('/compliance/checklists').then((r) => r.data);
export const getChecklist = (slug) => api.get(`/compliance/checklists/${slug}`).then((r) => r.data);
export const createChecklist = (payload) =>
  api.post('/compliance/checklists', payload).then((r) => r.data);
export const updateChecklist = (slug, payload) =>
  api.put(`/compliance/checklists/${slug}`, payload).then((r) => r.data);
export const deleteChecklist = (slug) =>
  api.delete(`/compliance/checklists/${slug}`).then((r) => r.data);
export const revalidate = (documentId, checklistId) =>
  api.post(`/compliance/validate/${documentId}`, checklistId ? { checklist_id: checklistId } : {}).then((r) => r.data);
