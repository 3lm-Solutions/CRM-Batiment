import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/shared';
import { EmptyState } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { LandingPage } from '@/features/public/LandingPage';
import { HOME_BY_ROLE } from './navigation';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** UX only — the API enforces the same roles (and returns 403 anyway). */
export function RequireRoles({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <EmptyState title="Accès non autorisé" description="Votre rôle ne permet pas d’ouvrir cette page." />;
  }
  return <>{children}</>;
}

/** `/`: the public home page for visitors, the role's home page once signed in. */
export function RoleHome() {
  const { user } = useAuth();
  return user ? <Navigate to={HOME_BY_ROLE[user.role]} replace /> : <LandingPage />;
}
