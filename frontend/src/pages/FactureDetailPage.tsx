import { useAuth } from '@/contexts/AuthContext';
import FactureEditorPage from '@/pages/factures/FactureEditorPage';

export default function FactureDetailPage() {
  const { user } = useAuth();

  const scope =
    user?.role === 'ASSISTANTE'
      ? 'assistante'
      : 'admin';

  return <FactureEditorPage scope={scope} />;
}
