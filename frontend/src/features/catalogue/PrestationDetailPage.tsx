import { ArrowLeft, ListChecks, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, CardHeader, ErrorState, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { formatEuros, formatNumber, formatUnite } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { usePrestation } from './api';
import { PrestationModal } from './CatalogueForms';
import { CompositionModal } from './CompositionModal';
import { ChiffrageSimulator } from './ChiffrageSimulator';
import { OptionsCard } from './OptionsCard';

export function PrestationDetailPage() {
  const id = Number(useParams().id);
  const { hasRole } = useAuth();
  const seesCosts = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const prestation = usePrestation(id);
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);

  if (prestation.isPending) return <Loading />;
  if (prestation.isError) return <ErrorState error={prestation.error} onRetry={() => void prestation.refetch()} />;
  const p = prestation.data;

  return (
    <>
      <Link to="/catalogue" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" /> Catalogue</Link>
      <PageHeader
        title={p.nom}
        description={`${p.categorie.nom}${p.sousCategorie ? ` › ${p.sousCategorie.nom}` : ''}${seesCosts ? ` · ${formatEuros(p.prixVenteMin)} à ${formatEuros(p.prixVenteMax)} HT` : ''} / ${formatUnite(p.unite)}`}
        actions={
          <>
            <StatusBadge kind="actif" value={p.actif} />
            {hasRole('ADMIN') && <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Modifier</Button>}
          </>
        }
      />

      {hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE') && (
        <Card className="mb-6">
          <CardHeader title="Simulateur de chiffrage" description="Quantité et options → coût de revient, prix suggéré et marge (réglages de l’entreprise)" />
          <div className="p-5"><ChiffrageSimulator prestation={p} /></div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Composition de base"
            description={`Ce que consomme 1 ${formatUnite(p.unite)}`}
            actions={
              hasRole('ADMIN') && (
                <Button size="sm" variant="outline" icon={<ListChecks className="size-4" />} onClick={() => setComposing(true)}>
                  {p.compositions.length ? 'Modifier la composition' : 'Saisir la composition'}
                </Button>
              )
            }
          />
          {p.compositions.length === 0 ? (
            <p className="p-5 text-sm text-amber-700">
              Aucune composition : le coût et la marge de cette prestation sont inconnus.
              {hasRole('ADMIN') && ' Cliquez sur « Saisir la composition ».'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {p.compositions.map((c) => {
                  const item = c.materiau ?? c.serviceMainOeuvre;
                  if (!item) return null;
                  return (
                    <tr key={c.id} className="border-t border-slate-100 first:border-0 dark:border-slate-800">
                      <td className="px-5 py-2.5">{item.nom} <span className="text-xs text-slate-500">{c.materiau ? 'matériau' : 'main d’œuvre'}</span></td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(c.quantiteParUnite)} {formatUnite(item.unite)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <OptionsCard prestation={p} canEdit={hasRole('ADMIN')} seesCosts={seesCosts} />
      </div>
      <PrestationModal open={editing} onClose={() => setEditing(false)} prestation={p} />
      {hasRole('ADMIN') && <CompositionModal open={composing} onClose={() => setComposing(false)} prestation={p} />}
    </>
  );
}
