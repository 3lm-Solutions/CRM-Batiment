/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '@/lib/api';
import type { User, AuthResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
  isAuthenticated: boolean;
  setSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    // If mustChangePassword, the backend returns no accessToken/user — don't store broken state
    if ((data as unknown as { mustChangePassword?: boolean }).mustChangePassword) {
      return data;
    }
    setToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...updatedUser } : currentUser));
  };

  const setSession = (token: string, user: User) => {
    setToken(token);
    setUser(user);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
