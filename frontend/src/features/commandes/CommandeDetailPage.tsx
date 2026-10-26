import { ArrowLeft, PackageCheck, Printer, Send, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, ErrorState, Input, Loading, Modal, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatEuros, formatNumber, formatUnite, fromDateInput, fullName, toDateInput } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import {
  RECEIVABLE,
  resteARecevoir,
  useCommande,
  useCommandeAction,
  useEnvoyerCommande,
  useReception,
  useUpdateCommande,
  useUpdateLignesCommande,
  type Commande,
  type CommandeAction,
} from './api';

function ReceptionModal({ open, onClose, commande }: { open: boolean; onClose: () => void; commande: Commande }) {
  const reception = useReception(commande.id);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  useEffect(() => {
    // Prefilled with what is still expected: a complete delivery is one click
    if (open) setQty(Object.fromEntries(commande.lignes.map((l) => [l.id, String(resteARecevoir(l))])));
  }, [open, commande]);

  const lignes = commande.lignes
    .map((l) => ({ ligneId: l.id, quantite: Number(qty[l.id] || 0) }))
    .filter((l) => l.quantite > 0);
  const tooMuch = commande.lignes.some((l) => Number(qty[l.id] || 0) > resteARecevoir(l));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Enregistrer une livraison"
      description="Quantités reçues dans cette livraison. Le stock des matériaux est mis à jour."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!lignes.length || tooMuch}
            loading={reception.isPending}
            onClick={() =>
              reception.mutate(
                { lignes, notes: notes.trim() || null },
                { onSuccess: () => { toast.success('Livraison enregistrée'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
            <th className="py-2">Matériau</th>
            <th className="py-2 text-right">Restant</th>
            <th className="w-32 py-2 text-right">Reçu</th>
          </tr>
        </thead>
        <tbody>
          {commande.lignes.map((l) => {
            const reste = resteARecevoir(l);
            const over = Number(qty[l.id] || 0) > reste;
            return (
              <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{l.materiauNom}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(reste)} {formatUnite(l.unite)}</td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    max={reste}
                    step="0.001"
                    disabled={reste === 0}
                    aria-label={`Quantité reçue ${l.materiauNom}`}
                    aria-invalid={over}
                    value={qty[l.id] ?? ''}
                    onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right aria-[invalid=true]:border-red-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tooMuch && <p className="mt-2 text-sm text-red-600">Une quantité dépasse le restant à recevoir.</p>}
      <Textarea label="Notes (bon de livraison, casse…)" containerClassName="mt-4" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Modal>
  );
}

function EditCommandeModal({ open, onClose, commande }: { open: boolean; onClose: () => void; commande: Commande }) {
  const update = useUpdateCommande(commande.id);
  const lignes = useUpdateLignesCommande(commande.id);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!open) return;
    setDate(toDateInput(commande.dateLivraisonPrevue));
    setNotes(commande.notes ?? '');
    setQty(Object.fromEntries(commande.lignes.map((l) => [l.id, String(l.quantite)])));
  }, [open, commande]);

  const changed = commande.lignes.filter((l) => Number(qty[l.id]) !== l.quantite);
  const invalid = commande.lignes.some((l) => !(Number(qty[l.id]) > 0));

  const save = () => {
    const onError = (e: unknown) => toast.error(errorMessage(e));
    const done = () => { toast.success('Commande mise à jour'); onClose(); };
    update.mutate(
      { dateLivraisonPrevue: fromDateInput(date), notes: notes.trim() || null },
      {
        onSuccess: () =>
          changed.length
            ? lignes.mutate(changed.map((l) => ({ ligneId: l.id, quantite: Number(qty[l.id]) })), { onSuccess: done, onError })
            : done(),
        onError,
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Modifier la commande"
      description="Ajustez les quantités calculées avant l’envoi au fournisseur."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={invalid} loading={update.isPending || lignes.isPending} onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {commande.lignes.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex-1">{l.materiauNom}</span>
              <input
                type="number"
                min={0.001}
                step="0.001"
                aria-label={`Quantité ${l.materiauNom}`}
                value={qty[l.id] ?? ''}
                onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="w-12 text-slate-500">{formatUnite(l.unite)}</span>
            </div>
          ))}
        </div>
        <Input label="Livraison prévue" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Textarea label="Notes pour le fournisseur" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

export function CommandeDetailPage() {
  const id = Number(useParams().id);
  const { hasRole } = useAuth();
  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const commande = useCommande(id);
  const envoyer = useEnvoyerCommande(id);
  const action = useCommandeAction(id);
  const [receiving, setReceiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<CommandeAction | null>(null);

  if (commande.isPending) return <Loading />;
  if (commande.isError) return <ErrorState error={commande.error} onRetry={() => void commande.refetch()} />;
  const c = commande.data;
  const s = c.statutLivraison;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const run = (a: CommandeAction) => action.mutate(a, { onSuccess: () => { toast.success('Commande mise à jour'); setConfirm(null); }, onError });

  return (
    <>
      <Link to="/commandes" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Commandes
      </Link>
      <PageHeader
        title={`Commande ${c.reference}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="commande" value={s} />
            <span>{c.fournisseur.nom}</span>
            {c.devis ? (
              <span>· devis <Link to={`/devis/${c.devis.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{c.devis.reference}</Link></span>
            ) : (
              <span>· commande manuelle</span>
            )}
            {c.chantier ? (
              <span>· chantier <Link to={`/chantiers/${c.chantier.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{c.chantier.reference}</Link></span>
            ) : c.devis?.chantierId ? (
              <span>· <Link to={`/chantiers/${c.devis.chantierId}`} className="text-brand-700 hover:underline dark:text-blue-300">chantier</Link></span>
            ) : (
              !c.devis && <span>· réapprovisionnement du stock</span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer</Button>
            {isBureau && s === 'CREEE' && (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
                <Button
                  icon={<Send className="size-4" />}
                  loading={envoyer.isPending}
                  onClick={() =>
                    envoyer.mutate(undefined, {
                      onSuccess: (r) => (r.emailSent ? toast.success(`Commande envoyée à ${c.fournisseur.email}`) : toast.warning('Commande marquée envoyée, mais l’email est parti en erreur.')),
                      onError,
                    })
                  }
                >
                  Envoyer au fournisseur
                </Button>
              </>
            )}
            {isBureau && s === 'ENVOYEE' && <Button variant="outline" icon={<Truck className="size-4" />} loading={action.isPending} onClick={() => run('expediee')}>Marquer expédiée</Button>}
            {RECEIVABLE.includes(s) && <Button icon={<PackageCheck className="size-4" />} onClick={() => setReceiving(true)}>Enregistrer une livraison</Button>}
            {isBureau && ['PARTIELLE', 'RECUE'].includes(s) && <Button variant="outline" onClick={() => setConfirm('cloturer')}>Clôturer</Button>}
            {isBureau && ['CREEE', 'ENVOYEE'].includes(s) && <Button variant="ghost" className="text-red-600" onClick={() => setConfirm('annuler')}>Annuler</Button>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="print-area lg:col-span-2">
          <CardHeader title="Lignes" description={`Livraison prévue : ${formatDate(c.dateLivraisonPrevue)}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 dark:border-slate-800">
                  <th className="px-4 py-3">Matériau</th>
                  <th className="px-4 py-3 text-right">Commandé</th>
                  <th className="px-4 py-3 text-right">Reçu</th>
                  {/* The chef receives the deliveries, he never sees the prices (B2) */}
                  {isBureau && <th className="px-4 py-3 text-right">PU HT</th>}
                  {isBureau && <th className="px-4 py-3 text-right">Total HT</th>}
                </tr>
              </thead>
              <tbody>
                {c.lignes.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">{l.materiauNom}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(l.quantite)} {formatUnite(l.unite)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${l.quantiteRecue >= l.quantite ? 'text-emerald-600' : l.quantiteRecue > 0 ? 'text-amber-600' : ''}`}>{formatNumber(l.quantiteRecue)}</td>
                    {isBureau && <td className="px-4 py-3 text-right tabular-nums">{formatEuros(l.prixUnitaire)}</td>}
                    {isBureau && <td className="px-4 py-3 text-right font-medium tabular-nums">{formatEuros(l.totalHT)}</td>}
                  </tr>
                ))}
              </tbody>
              {isBureau && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold">Total HT</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatEuros(c.totalHT)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {c.notes && <p className="whitespace-pre-line border-t border-slate-100 px-5 py-4 text-sm dark:border-slate-800">{c.notes}</p>}
        </Card>

        <div className="space-y-6 print:hidden">
          <Card>
            <CardHeader title="Fournisseur" />
            <dl className="space-y-2 p-5 text-sm">
              <div><dt className="text-xs text-slate-500">Nom</dt><dd className="font-medium">{c.fournisseur.nom}</dd></div>
              <div><dt className="text-xs text-slate-500">Email</dt><dd>{c.fournisseur.email ?? <span className="text-amber-700">À renseigner avant l’envoi</span>}</dd></div>
              <div><dt className="text-xs text-slate-500">Téléphone</dt><dd>{c.fournisseur.telephone ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Envoyée le</dt><dd>{formatDateTime(c.dateEnvoi)}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Livraisons" description={`${c.receptions.length} réception(s)`} />
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {c.receptions.length === 0 && <li className="px-5 py-4 text-slate-500">Rien de reçu pour l’instant.</li>}
              {c.receptions.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <p className="font-medium">{formatDateTime(r.dateReception)}{r.user && <span className="font-normal text-slate-500"> · {fullName(r.user)}</span>}</p>
                  <ul className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {r.lignes.map((rl) => {
                      const l = c.lignes.find((x) => x.id === rl.ligneCommandeId);
                      return <li key={rl.id}>{formatNumber(rl.quantite)} {l ? `${formatUnite(l.unite)} · ${l.materiauNom}` : ''}</li>;
                    })}
                  </ul>
                  {r.notes && <p className="mt-1 text-xs italic">{r.notes}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ReceptionModal open={receiving} onClose={() => setReceiving(false)} commande={c} />
      <EditCommandeModal open={editing} onClose={() => setEditing(false)} commande={c} />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        danger={confirm === 'annuler'}
        title={confirm === 'annuler' ? 'Annuler la commande' : 'Clôturer la commande'}
        message={confirm === 'annuler' ? 'La commande passe à ANNULÉE. Prévenez le fournisseur si elle lui a été envoyée.' : 'Les quantités non livrées sont abandonnées. La commande est terminée.'}
        confirmLabel={confirm === 'annuler' ? 'Annuler la commande' : 'Clôturer'}
        loading={action.isPending}
        onConfirm={() => confirm && run(confirm)}
      />
    </>
  );
}
