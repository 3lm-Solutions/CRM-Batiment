import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

const defaultRouteByRole: Record<Role, string> = {
  ADMIN: '/admin',
  TECHNICO: '/technico',
  ASSISTANTE: '/assistante',
  CHEF_CHANTIER: '/chef-chantier',
  SOUS_TRAITANT: '/sous-traitant',
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={defaultRouteByRole[user.role]} replace />;
  }

  return <Outlet />;
}
