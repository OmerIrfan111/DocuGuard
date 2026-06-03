import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken, setAuthFailureHandler } from '../api/axiosInstance';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  // Restore the session on page load via the httpOnly refresh cookie.
  const refreshSession = useCallback(async () => {
    try {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.access_token);
      const me = await api.get('/auth/me');
      setUser(me.data);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    setAuthFailureHandler(clearSession);
    refreshSession();
  }, [refreshSession, clearSession]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.access_token);
    const me = await api.get('/auth/me');
    setUser(me.data);
    return me.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    clearSession();
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshSession,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
