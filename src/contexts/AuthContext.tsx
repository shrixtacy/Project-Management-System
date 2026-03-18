import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import * as api from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.seedIfEmpty();
    const stored = api.getCurrentUser();
    setUser(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, password: string) => {
    const u = api.login(email, password);
    if (u) {
      api.setCurrentUser(u);
      setUser(u);
    }
    return u;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
