import { createContext, useContext, ReactNode } from 'react';

type RemovedAuthAction = (...args: any[]) => Promise<never>;
type LegacyUser = {
  id?: string;
  email?: string;
  display_name?: string;
  name?: string;
  [key: string]: any;
} | null;

interface AuthContextType {
  user: LegacyUser;
  loading: boolean;
  isAuthenticated: boolean;
  login: RemovedAuthAction;
  register: RemovedAuthAction;
  logout: RemovedAuthAction;
  refreshUser: RemovedAuthAction;
}

const FEATURE_REMOVED_MESSAGE = '用户体系已下线：后端当前只保留纯图片 SaaS 能力。';

function removedAuthAction(): Promise<never> {
  return Promise.reject(new Error(FEATURE_REMOVED_MESSAGE));
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: null,
        loading: false,
        isAuthenticated: false,
        login: removedAuthAction,
        register: removedAuthAction,
        logout: removedAuthAction,
        refreshUser: removedAuthAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
