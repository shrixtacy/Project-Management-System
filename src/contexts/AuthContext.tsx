import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import * as api from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      api.seedIfEmpty();
      try {
        const stored = await api.getCurrentUser();
        setUser(stored);
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const u = await api.login(email, password);
      if (u) {
        setUser(u);
      }
      return u;
    } catch (e) {
      console.error('Login failed', e);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
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
