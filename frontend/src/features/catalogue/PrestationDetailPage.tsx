import { ArrowLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, ErrorState, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { formatEuros, formatNumber, formatUnite } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { usePrestation } from './api';
import { PrestationModal } from './CatalogueForms';
import { ChiffrageSimulator } from './ChiffrageSimulator';

export function PrestationDetailPage() {
  const id = Number(useParams().id);
  const { hasRole } = useAuth();
  const prestation = usePrestation(id);
  const [editing, setEditing] = useState(false);

  if (prestation.isPending) return <Loading />;
  if (prestation.isError) return <ErrorState error={prestation.error} onRetry={() => void prestation.refetch()} />;
  const p = prestation.data;

  return (
    <>
      <Link to="/catalogue" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" /> Catalogue</Link>
      <PageHeader
        title={p.nom}
        description={`${p.categorie.nom}${p.sousCategorie ? ` › ${p.sousCategorie.nom}` : ''} · ${formatEuros(p.prixVenteMin)} à ${formatEuros(p.prixVenteMax)} HT / ${formatUnite(p.unite)}`}
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
          <CardHeader title="Composition de base" description={`Ce que consomme 1 ${formatUnite(p.unite)}`} />
          {p.compositions.length === 0 ? (
            <p className="p-5 text-sm text-amber-700">Aucune composition : le coût et la marge de cette prestation sont inconnus.</p>
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

        <Card>
          <CardHeader title="Options" description="Choisies par le client dans le devis" />
          <div className="space-y-4 p-5">
            {p.options.length === 0 && <p className="text-sm text-slate-500">Aucune option.</p>}
            {p.options.map((o) => (
              <div key={o.id}>
                <p className="text-sm font-semibold">{o.nom} {o.obligatoire && <Badge tone="blue" className="ml-1">obligatoire</Badge>}</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {o.choix.map((c) => (
                    <li key={c.id}>
                      <Badge tone={c.compositions.length ? 'violet' : 'slate'}>
                        {c.nom}{c.impactPrix ? ` (${c.impactPrix > 0 ? '+' : ''}${formatEuros(c.impactPrix)})` : ''}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {p.options.some((o) => o.choix.some((c) => c.compositions.length)) && (
              <p className="text-xs text-slate-500">En violet : choix ayant leur propre composition (elle remplace la composition de base).</p>
            )}
          </div>
        </Card>
      </div>
      <PrestationModal open={editing} onClose={() => setEditing(false)} prestation={p} />
    </>
  );
}
