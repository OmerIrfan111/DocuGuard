import api from './axiosInstance';

export const listUsers = () => api.get('/users').then((r) => r.data);
export const updateUserRole = (id, role) =>
  api.patch(`/users/${id}/role`, { role }).then((r) => r.data);
export const setUserActive = (id, isActive) =>
  api.patch(`/users/${id}/deactivate`, { is_active: isActive }).then((r) => r.data);
