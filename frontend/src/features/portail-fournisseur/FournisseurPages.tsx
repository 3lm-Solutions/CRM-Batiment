import { ArrowLeft, CheckCircle2, MapPin, Package, PackageCheck, Printer, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, DataTable, ErrorState, Input, Loading, PageHeader, Pagination, SearchInput, Stat, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatEuros, formatNumber, formatUnite, fromDateInput, toDateInput } from '@/lib/format';
import type { CommandeStatut } from '../commandes/api';
import { useFCommande, useFCommandes, useFournisseurDashboard, useRepondreCommande } from './api';

export function FournisseurDashboardPage() {
  const d = useFournisseurDashboard();
  if (d.isPending) return <Loading />;
  if (d.isError) return <ErrorState error={d.error} onRetry={() => void d.refetch()} />;
  const v = d.data;
  return (
    <>
      <PageHeader title={`Espace fournisseur — ${v.fournisseur.nom}`} description="Commandes reçues de l’entreprise" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CheckCircle2 />} iconTone="orange" label="À confirmer" value={v.aAccuser} tone={v.aAccuser ? 'warning' : 'default'} hint="accusé de réception attendu" />
        <Stat icon={<Package />} iconTone="blue" label="À expédier" value={v.aExpedier} />
        <Stat icon={<Truck />} iconTone="purple" label="En livraison" value={v.enLivraison} />
        <Stat icon={<PackageCheck />} iconTone="green" label="Livrées" value={v.livrees} />
      </div>
      <div className="mt-6">
        <Link to="/portail/commandes"><Button>Voir mes commandes</Button></Link>
      </div>
    </>
  );
}

const TABS: { value: string; label: string; statuts?: CommandeStatut[] }[] = [
  { value: 'todo', label: 'À traiter', statuts: ['ENVOYEE'] },
  { value: 'shipping', label: 'En livraison', statuts: ['EXPEDIEE', 'PARTIELLE'] },
  { value: 'done', label: 'Livrées', statuts: ['RECUE', 'CLOTUREE'] },
  { value: 'all', label: 'Toutes' },
];

export function FournisseurCommandesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todo');
  const [query, setQuery] = useState<{ page: number; search: string; statuts?: CommandeStatut[] }>({ page: 1, search: '', statuts: TABS[0].statuts });
  const list = useFCommandes(query);
  return (
    <>
      <PageHeader title="Mes commandes" />
      <Tabs value={tab} onChange={(v) => { setTab(v); setQuery((q) => ({ ...q, page: 1, statuts: TABS.find((t) => t.value === v)?.statuts })); }} tabs={TABS} />
      <Card>
        <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Référence…" />
        </div>
        {list.isError ? (
          <div className="p-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
        ) : (
          <DataTable
            loading={list.isPending}
            rows={list.data?.data}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/portail/commandes/${c.id}`)}
            empty={{ title: 'Aucune commande' }}
            columns={[
              { key: 'ref', header: 'Référence', cell: (c) => <span className="font-medium">{c.reference}</span> },
              { key: 'date', header: 'Reçue le', cell: (c) => formatDate(c.dateEnvoi) },
              { key: 'lignes', header: 'Articles', align: 'right', cell: (c) => c.nombreLignes },
              { key: 'total', header: 'Total HT', align: 'right', cell: (c) => <span className="tabular-nums">{formatEuros(c.totalHT)}</span> },
              { key: 'livraison', header: 'Livraison prévue', cell: (c) => formatDate(c.dateLivraisonPrevue) },
              {
                key: 'statut',
                header: 'Statut',
                cell: (c) => (
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge kind="commande" value={c.statutLivraison} />
                    {c.statutLivraison === 'ENVOYEE' && !c.dateAccuseReception && <Badge tone="amber">À confirmer</Badge>}
                  </span>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={list.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
    </>
  );
}

export function FournisseurCommandePage() {
  const id = Number(useParams().id);
  const commande = useFCommande(id);
  const repondre = useRepondreCommande(id);
  const [dialog, setDialog] = useState<'accuser-reception' | 'expediee' | null>(null);
  const [date, setDate] = useState('');
  const [commentaire, setCommentaire] = useState('');

  if (commande.isPending) return <Loading />;
  if (commande.isError) return <ErrorState error={commande.error} onRetry={() => void commande.refetch()} />;
  const c = commande.data;
  const openDialog = (d: 'accuser-reception' | 'expediee') => {
    setDate(toDateInput(c.dateLivraisonPrevue));
    setCommentaire(c.commentaireFournisseur ?? '');
    setDialog(d);
  };

  return (
    <>
      <Link to="/portail/commandes" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Mes commandes
      </Link>
      <PageHeader
        title={`Commande ${c.reference}`}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge kind="commande" value={c.statutLivraison} /> reçue le {formatDate(c.dateEnvoi)}</span>}
        actions={
          <>
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer</Button>
            {c.statutLivraison === 'ENVOYEE' && !c.dateAccuseReception && <Button variant="outline" icon={<CheckCircle2 className="size-4" />} onClick={() => openDialog('accuser-reception')}>Confirmer la commande</Button>}
            {c.statutLivraison === 'ENVOYEE' && <Button icon={<Truck className="size-4" />} onClick={() => openDialog('expediee')}>Signaler l’expédition</Button>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="print-area lg:col-span-2">
          <CardHeader title="Articles" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 dark:border-slate-800">
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3 text-right">Quantité</th>
                  <th className="px-4 py-3 text-right">Reçu</th>
                  <th className="px-4 py-3 text-right">PU HT</th>
                  <th className="px-4 py-3 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {c.lignes.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">{l.materiauNom}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(l.quantite)} {formatUnite(l.unite)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(l.quantiteRecue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEuros(l.prixUnitaire)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatEuros(l.totalHT)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="px-4 py-3 text-right font-semibold">Total HT</td><td className="px-4 py-3 text-right font-bold tabular-nums">{formatEuros(c.totalHT)}</td></tr>
              </tfoot>
            </table>
          </div>
          {c.notes && <p className="whitespace-pre-line border-t border-slate-100 px-5 py-4 text-sm dark:border-slate-800"><span className="font-semibold">Note de l’entreprise :</span> {c.notes}</p>}
        </Card>
        <Card>
          <CardHeader title="Livraison" />
          <dl className="space-y-3 p-5 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Adresse</dt>
              <dd className="flex items-start gap-1"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {c.adresseLivraison ?? 'À confirmer avec l’entreprise'}</dd>
            </div>
            <div><dt className="text-xs text-slate-500">Date prévue</dt><dd>{formatDate(c.dateLivraisonPrevue)}</dd></div>
            <div><dt className="text-xs text-slate-500">Commande confirmée</dt><dd>{c.dateAccuseReception ? formatDate(c.dateAccuseReception) : 'Non'}</dd></div>
            {c.commentaireFournisseur && <div><dt className="text-xs text-slate-500">Votre commentaire</dt><dd>{c.commentaireFournisseur}</dd></div>}
          </dl>
        </Card>
      </div>
      <ConfirmDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'expediee' ? 'Signaler l’expédition' : 'Confirmer la commande'}
        message={dialog === 'expediee' ? 'L’entreprise est prévenue que la marchandise est en route.' : 'L’entreprise est prévenue que vous avez bien reçu la commande.'}
        confirmLabel={dialog === 'expediee' ? 'Expédiée' : 'Confirmer'}
        loading={repondre.isPending}
        onConfirm={() =>
          dialog &&
          repondre.mutate(
            { action: dialog, dateLivraisonPrevue: fromDateInput(date) ?? undefined, commentaire: commentaire.trim() || null },
            { onSuccess: () => { toast.success('Merci, l’entreprise est prévenue'); setDialog(null); }, onError: (e) => toast.error(errorMessage(e)) },
          )
        }
      >
        <div className="space-y-3">
          <Input label="Date de livraison prévue" type="date" min={toDateInput(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
          <Textarea label="Commentaire" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Créneau, article en reliquat…" />
        </div>
      </ConfirmDialog>
    </>
  );
}
