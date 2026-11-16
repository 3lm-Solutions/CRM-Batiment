import { useState, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  prenom: string;
  nom: string;
  role: string;
}

interface Session {
  token: string;
  user: User;
}

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = () => {
    try {
      const stored = sessionStorage.getItem('baticrm_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.user) {
          setSession(parsed);
          console.log('✅ Session chargée avec succès');
        } else {
          console.warn('⚠️ Session invalide - token manquant');
          sessionStorage.removeItem('baticrm_session');
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement de la session:', error);
      sessionStorage.removeItem('baticrm_session');
    } finally {
      setIsLoading(false);
    }
  };

  const setAuth = (token: string, user: User) => {
    const newSession = { token, user };
    sessionStorage.setItem('baticrm_session', JSON.stringify(newSession));
    setSession(newSession);
    console.log('✅ Session créée');
  };

  const clearAuth = () => {
    sessionStorage.removeItem('baticrm_session');
    setSession(null);
    console.log('✅ Session supprimée');
  };

  const getToken = () => {
    return session?.token || null;
  };

  const getUser = () => {
    return session?.user || null;
  };

  const isAuthenticated = () => {
    return !!session?.token;
  };

  return {
    session,
    isLoading,
    setAuth,
    clearAuth,
    getToken,
    getUser,
    isAuthenticated,
  };
};