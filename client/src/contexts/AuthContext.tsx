import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  getLocalUser,
  setLocalUser,
  clearLocalUser,
  generateUserId,
  type LocalUser,
} from "@/lib/localUser";

interface AuthContextType {
  user: LocalUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (nickname: string, phone?: string) => void;
  register: (nickname: string, phone?: string) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(() => getLocalUser());

  const login = useCallback((nickname: string, phone?: string) => {
    const existing = getLocalUser();
    if (existing) {
      const updated = { ...existing, nickname, phone: phone || existing.phone };
      setLocalUser(updated);
      setUser(updated);
    } else {
      const newUser: LocalUser = {
        id: generateUserId(),
        nickname,
        phone,
        created_at: new Date().toISOString(),
      };
      setLocalUser(newUser);
      setUser(newUser);
    }
  }, []);

  const register = login;

  const logout = useCallback(() => {
    clearLocalUser();
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => {
    setUser(getLocalUser());
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
