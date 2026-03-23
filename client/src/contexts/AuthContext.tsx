import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authAPI } from '@/lib/api';

interface User {
  id: string;
  email: string;
  display_name: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      if (!token) { setUser(null); setLoading(false); return; }
      const userData = await authAPI.me();
      setUser(userData);
      sessionStorage.setItem('auth_user', JSON.stringify(userData));
    } catch {
      setUser(null);
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try to restore user from session
    const savedUser = sessionStorage.getItem('auth_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
    refreshUser();

    // Listen for forced logout
    const handleLogout = () => {
      setUser(null);
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [refreshUser]);

  // Token refresh timer
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(async () => {
      try {
        const data = await authAPI.refresh();
        if (data?.access_token) {
          sessionStorage.setItem('auth_token', data.access_token);
        }
      } catch { /* ignore */ }
    }, 100 * 60 * 1000); // every 100 minutes
    return () => clearInterval(timer);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authAPI.login(email, password);
    sessionStorage.setItem('auth_token', data.access_token);
    const userData = data.user || await authAPI.me();
    setUser(userData);
    sessionStorage.setItem('auth_user', JSON.stringify(userData));
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const data = await authAPI.register(email, password, displayName);
    if (data.access_token) {
      sessionStorage.setItem('auth_token', data.access_token);
      const userData = data.user || await authAPI.me();
      setUser(userData);
      sessionStorage.setItem('auth_user', JSON.stringify(userData));
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    setUser(null);
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('current_session_id');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user,
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
