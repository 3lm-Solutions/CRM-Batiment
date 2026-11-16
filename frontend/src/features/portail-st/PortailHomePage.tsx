import { useAuth } from '../auth/auth-context';
import { FournisseurDashboardPage } from '../portail-fournisseur/FournisseurPages';
import { StDashboardPage } from './StPages';

/** /portail: the home of an external account, by role. */
export function PortailHomePage() {
  const { user } = useAuth();
  return user?.role === 'FOURNISSEUR' ? <FournisseurDashboardPage /> : <StDashboardPage />;
}
