import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, SessionUser } from '@/shared';
import { setSessionExpiredHandler } from '@/lib/api';
import { authStorage } from '@/lib/auth-storage';
import { queryClient } from '@/lib/query-client';

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  signIn: (token: string, user: SessionUser) => void;
  signOut: () => void;
  hasRole: (...roles: Role[]) => boolean;
  /** Set when the API answered 401 (expired, revoked or deactivated): the login page explains why */
  sessionExpired: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(authStorage.getUser);
  const [token, setToken] = useState(authStorage.getToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  const signOut = useCallback(() => {
    authStorage.clear();
    queryClient.clear(); // never show the previous user's cached data
    setUser(null);
    setToken(null);
  }, []);

  const signIn = useCallback((newToken: string, newUser: SessionUser) => {
    authStorage.save(newToken, newUser);
    queryClient.clear();
    setSessionExpired(false);
    setToken(newToken);
    setUser(newUser);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSessionExpired(true);
      signOut();
    });
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, signIn, signOut, sessionExpired, hasRole: (...roles) => !!user && roles.includes(user.role) }),
    [user, token, signIn, signOut, sessionExpired],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
