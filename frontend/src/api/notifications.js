import api from './axiosInstance';

export const listNotifications = (limit = 10) =>
  api.get('/notifications', { params: { limit } }).then((r) => r.data);
export const markRead = (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data);
export const markAllRead = () => api.patch('/notifications/read-all').then((r) => r.data);
