import { Link2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros, formatUnite, fromDateInput } from '@/lib/format';
import { useFournisseurOptions, useMateriaux } from '../catalogue/api';
import { useAuth } from '../auth/auth-context';
import { useChantiers } from '../chantiers/api';
import { RattacherMateriauxModal } from '../fournisseurs/MateriauxPicker';
import { useCreateCommande } from './api';

interface Row {
  key: number;
  materiauId: string;
  quantite: string;
}

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, materiauId: '', quantite: '' });

/**
 * Manual supplier order (report of 20/10): pick the supplier first, then only ITS materials.
 * Prices come from the catalogue; the order is created « À envoyer » and follows the usual flow.
 */
export function NouvelleCommandeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateCommande();
  const { hasRole } = useAuth();
  // Linking materials to a supplier is a catalogue change: ADMIN only
  const canLink = hasRole('ADMIN');
  const [linking, setLinking] = useState(false);
  const fournisseurs = useFournisseurOptions(open);
  const chantiers = useChantiers({ page: 1, limit: 100, statuts: ['PLANIFIE', 'EN_COURS', 'SUSPENDU'] }, open);

  const [fournisseurId, setFournisseurId] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [dateLivraison, setDateLivraison] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const materiaux = useMateriaux({ page: 1, limit: 100, actif: 'true', fournisseurId: fournisseurId ? Number(fournisseurId) : undefined });
  const options = fournisseurId ? (materiaux.data?.data ?? []) : [];

  useEffect(() => {
    if (!open) return;
    setFournisseurId('');
    setChantierId('');
    setDateLivraison('');
    setNotes('');
    setRows([emptyRow()]);
  }, [open]);

  const lignes = rows
    .filter((r) => r.materiauId && Number(r.quantite) > 0)
    .map((r) => ({ materiauId: Number(r.materiauId), quantite: Number(r.quantite) }));
  const duplicate = new Set(lignes.map((l) => l.materiauId)).size !== lignes.length;
  const total = lignes.reduce((sum, l) => sum + (options.find((m) => m.id === l.materiauId)?.prixAchatFixe ?? 0) * l.quantite, 0);

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () =>
    create.mutate(
      {
        fournisseurId: Number(fournisseurId),
        chantierId: chantierId ? Number(chantierId) : null,
        dateLivraisonPrevue: fromDateInput(dateLivraison),
        notes: notes.trim() || null,
        lignes,
      },
      {
        onSuccess: (commande) => {
          toast.success(`Commande ${commande.reference} créée — vérifiez puis envoyez-la au fournisseur`);
          onClose();
          navigate(`/commandes/${commande.id}`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Nouvelle commande fournisseur"
      description="Choisissez le fournisseur : seuls ses matériaux sont proposés, au prix d’achat du catalogue."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!fournisseurId || !lignes.length || duplicate} loading={create.isPending} onClick={submit}>
            Créer la commande
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Fournisseur"
          required
          placeholder="Choisir…"
          options={(fournisseurs.data ?? []).map((f) => ({ value: f.id, label: f.nom }))}
          value={fournisseurId}
          onChange={(e) => {
            setFournisseurId(e.target.value);
            setRows([emptyRow()]); // materials belong to the previous supplier
          }}
        />
        <Select
          label="Chantier livré"
          placeholder="Aucun (réapprovisionnement du stock)"
          options={(chantiers.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.reference} — ${c.adresse}` }))}
          value={chantierId}
          onChange={(e) => setChantierId(e.target.value)}
        />
        <Input label="Livraison souhaitée" type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} hint="Vide : délai habituel du fournisseur" />
      </div>

      <fieldset className="mt-5" disabled={!fournisseurId}>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Matériaux</legend>
        {fournisseurId && materiaux.data && options.length === 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <span>
              Aucun matériau n’est rattaché à ce fournisseur.
              {!canLink && ' Demandez à un administrateur de les rattacher (Fournisseurs › Modifier).'}
            </span>
            {canLink && (
              <Button size="sm" icon={<Link2 className="size-4" />} onClick={() => setLinking(true)}>
                Rattacher des matériaux
              </Button>
            )}
          </div>
        )}
        {fournisseurId && canLink && options.length > 0 && options.length < 100 && (
          <button type="button" className="mb-2 text-xs font-medium text-brand-700 hover:underline dark:text-blue-300" onClick={() => setLinking(true)}>
            Un matériau manque ? Rattacher d’autres matériaux à ce fournisseur
          </button>
        )}
        <div className="space-y-2">
          {rows.map((r) => {
            const m = options.find((x) => x.id === Number(r.materiauId));
            return (
              <div key={r.key} className="flex flex-wrap items-end gap-2">
                <Select
                  aria-label="Matériau"
                  containerClassName="min-w-0 flex-1"
                  placeholder={fournisseurId ? 'Choisir un matériau…' : 'Choisissez d’abord le fournisseur'}
                  options={options.map((x) => ({ value: x.id, label: `${x.nom} — ${formatEuros(x.prixAchatFixe)} / ${formatUnite(x.unite)}` }))}
                  value={r.materiauId}
                  onChange={(e) => setRow(r.key, { materiauId: e.target.value })}
                />
                <Input
                  aria-label="Quantité"
                  type="number"
                  min={0}
                  step="0.001"
                  containerClassName="w-28"
                  placeholder={m ? formatUnite(m.unite) : 'Qté'}
                  value={r.quantite}
                  onChange={(e) => setRow(r.key, { quantite: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Retirer la ligne"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  icon={<Trash2 className="size-4" />}
                />
              </div>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          Ajouter un matériau
        </Button>
        {duplicate && <p className="mt-2 text-sm text-red-600">Un même matériau apparaît deux fois.</p>}
      </fieldset>

      <p className="mt-4 text-right text-sm">
        Total HT estimé : <span className="font-semibold tabular-nums">{formatEuros(total)}</span>
      </p>
      <Textarea label="Notes" containerClassName="mt-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {canLink && (
        <RattacherMateriauxModal
          open={linking}
          onClose={() => setLinking(false)}
          fournisseur={fournisseurId ? { id: Number(fournisseurId), nom: fournisseurs.data?.find((f) => f.id === Number(fournisseurId))?.nom ?? '' } : null}
        />
      )}
    </Modal>
  );
}
