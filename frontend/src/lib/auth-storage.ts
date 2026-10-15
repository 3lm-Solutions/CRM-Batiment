import type { SessionUser } from '@/shared';

const TOKEN_KEY = 'crm.token';
const USER_KEY = 'crm.user';

/** Session persistence. The API re-validates the token on every request (account active, not revoked). */
export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  },
  save(token: string, user: SessionUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
