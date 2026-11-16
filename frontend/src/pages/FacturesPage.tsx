import { useAuth } from '@/contexts/AuthContext';
import FacturesListPage from '@/pages/factures/FacturesListPage';

export default function FacturesPage() {
  const { user } = useAuth();

  const scope =
    user?.role === 'ASSISTANTE'
      ? 'assistante'
      : 'admin';

  return <FacturesListPage scope={scope} />;
}