import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Le lien est peut-être incorrect ou la page a été déplacée."
      action={<Link to="/" className="font-semibold text-brand-700 underline">Retour à l’accueil</Link>}
    />
  );
}
