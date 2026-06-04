import api from './axiosInstance';

export const registerUser = (payload) => api.post('/auth/register', payload);
export const loginUser = (email, password) => api.post('/auth/login', { email, password });
export const refreshToken = () => api.post('/auth/refresh');
export const logoutUser = () => api.post('/auth/logout');
export const fetchMe = () => api.get('/auth/me');
export const changePassword = (current_password, new_password) =>
  api.patch('/auth/password', { current_password, new_password }).then((r) => r.data);
