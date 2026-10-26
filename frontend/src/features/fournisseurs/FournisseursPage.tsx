import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, Card, ConfirmDialog, DataTable, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { usePortalAccounts } from '../users/api';
import { useDeleteFournisseur, useFournisseurs, useLierCompteFournisseur, useSaveFournisseur, type Fournisseur } from './api';
import { MateriauxPicker, useMateriauxDuFournisseur } from './MateriauxPicker';

const EMPTY = { nom: '', contact: '', email: '', telephone: '', adresse: '', delaiLivraison: '', conditions: '' };

function FournisseurModal({ open, onClose, fournisseur }: { open: boolean; onClose: () => void; fournisseur?: Fournisseur }) {
  const save = useSaveFournisseur();
  const lier = useLierCompteFournisseur();
  // Existing FOURNISSEUR accounts; those already linked to another supplier are shown disabled
  const comptes = usePortalAccounts('FOURNISSEUR', open);
  const tous = useFournisseurs({ page: 1, limit: 100 }, open);
  const lieA = new Map((tous.data?.data ?? []).filter((x) => x.userId && x.id !== fournisseur?.id).map((x) => [x.userId!, x.nom]));
  const [f, setF] = useState(EMPTY);
  const [compte, setCompte] = useState('');
  const [actif, setActif] = useState(true);
  // Materials it supplies (21/10): picked in the catalogue instead of a free text
  const actuels = useMateriauxDuFournisseur(fournisseur?.id, open);
  const [materiauIds, setMateriauIds] = useState<number[]>([]);
  const [materiauxTouches, setMateriauxTouches] = useState(false);
  // 100 = the page size: more than that cannot be edited safely here (catalogue › Matériaux)
  const tropDeMateriaux = (actuels.data?.length ?? 0) >= 100;
  useEffect(() => {
    if (!open) return;
    setMateriauIds(fournisseur ? (actuels.data ?? []).map((m) => m.id) : []);
    setMateriauxTouches(false);
  }, [open, fournisseur, actuels.data]);

  useEffect(() => {
    if (!open) return;
    setF(
      fournisseur
        ? {
            nom: fournisseur.nom,
            contact: fournisseur.contact ?? '',
            email: fournisseur.email ?? '',
            telephone: fournisseur.telephone ?? '',
            adresse: fournisseur.adresse ?? '',
            delaiLivraison: fournisseur.delaiLivraison?.toString() ?? '',
            conditions: fournisseur.conditions ?? '',
          }
        : EMPTY,
    );
    setCompte(fournisseur?.userId ? String(fournisseur.userId) : '');
    setActif(fournisseur?.actif ?? true);
  }, [open, fournisseur]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const orNull = (v: string) => v.trim() || null;
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const submit = () =>
    save.mutate(
      {
        id: fournisseur?.id,
        nom: f.nom.trim(),
        contact: orNull(f.contact),
        email: orNull(f.email),
        telephone: orNull(f.telephone),
        adresse: orNull(f.adresse),
        // Sent only if changed: an untouched list is never rewritten
        ...(materiauxTouches && !tropDeMateriaux ? { materiauIds } : {}),
        delaiLivraison: f.delaiLivraison ? Number(f.delaiLivraison) : null,
        conditions: orNull(f.conditions),
        ...(fournisseur && { actif }),
        ...(!fournisseur && compte && { userId: Number(compte) }),
      },
      {
        onSuccess: (saved) => {
          const linked = fournisseur?.userId ? String(fournisseur.userId) : '';
          const done = () => { toast.success(fournisseur ? 'Fournisseur modifié' : 'Fournisseur créé'); onClose(); };
          if (fournisseur && compte !== linked) lier.mutate({ id: saved.id, userId: compte ? Number(compte) : null }, { onSuccess: done, onError });
          else done();
        },
        onError,
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={fournisseur ? `Modifier ${fournisseur.nom}` : 'Nouveau fournisseur'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!f.nom.trim()} loading={save.isPending || lier.isPending}>Enregistrer</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={fournisseur ? 'Compte du portail fournisseur' : 'Créer depuis un compte existant'}
          containerClassName="sm:col-span-2"
          hint={
            fournisseur
              ? 'Ce compte (rôle Fournisseur) voit les commandes de ce fournisseur dans son portail.'
              : 'Facultatif — le compte (rôle Fournisseur, créé dans Utilisateurs) verra les commandes dans son portail. Contact, email et téléphone sont repris.'
          }
          placeholder="Aucun"
          options={(comptes.data ?? []).map((u) => ({
            value: u.id,
            label: `${fullName(u)} — ${u.email}${lieA.has(u.id) ? ` (déjà lié à ${lieA.get(u.id)})` : ''}`,
          }))}
          value={compte}
          onChange={(e) => {
            const id = e.target.value;
            if (id && lieA.has(Number(id))) {
              toast.error(`Ce compte est déjà lié à « ${lieA.get(Number(id))} ». Déliez-le d’abord.`);
              return;
            }
            setCompte(id);
            const u = comptes.data?.find((x) => x.id === Number(id));
            // Prefill the empty fields from the account (creation only)
            if (u && !fournisseur) {
              setF((s) => ({ ...s, contact: s.contact || fullName(u), email: s.email || u.email, telephone: s.telephone || (u.telephone ?? '') }));
            }
          }}
        />
        <Input label="Raison sociale" required value={f.nom} onChange={set('nom')} />
        <Input label="Contact" value={f.contact} onChange={set('contact')} />
        <Input label="Email" type="email" hint="Les bons de commande y sont envoyés" value={f.email} onChange={set('email')} />
        <Input label="Téléphone" type="tel" value={f.telephone} onChange={set('telephone')} />
        <Input label="Adresse" containerClassName="sm:col-span-2" value={f.adresse} onChange={set('adresse')} />
        <Input label="Délai de livraison (jours)" type="number" min={0} value={f.delaiLivraison} onChange={set('delaiLivraison')} />
        <div className="sm:col-span-2">
          {tropDeMateriaux ? (
            <p className="text-sm text-slate-500">Ce fournisseur fournit plus de 100 matériaux : modifiez-les dans Catalogue › Matériaux.</p>
          ) : (
            <MateriauxPicker
              value={materiauIds}
              onChange={(ids) => { setMateriauIds(ids); setMateriauxTouches(true); }}
              fournisseurId={fournisseur?.id}
              initial={actuels.data}
              enabled={open}
            />
          )}
        </div>
        <Textarea label="Conditions" containerClassName="sm:col-span-2" rows={2} value={f.conditions} onChange={set('conditions')} />
        {fournisseur && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-brand-700" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            Fournisseur actif (décoché : n’apparaît plus dans les nouvelles commandes)
          </label>
        )}
      </div>
    </Modal>
  );
}

export function FournisseursPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [query, setQuery] = useState<{ page: number; search: string; actif: '' | 'true' | 'false' }>({ page: 1, search: '', actif: 'true' });
  const list = useFournisseurs(query);
  const remove = useDeleteFournisseur();
  const [editing, setEditing] = useState<Fournisseur | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Fournisseur | null>(null);

  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description="Coordonnées, délais et comptes du portail"
        actions={isAdmin && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nouveau fournisseur</Button>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Rechercher un fournisseur…" />
        <Select
          aria-label="Statut"
          containerClassName="w-44"
          options={[{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }]}
          placeholder="Tous les statuts"
          value={query.actif}
          onChange={(e) => setQuery((q) => ({ ...q, actif: e.target.value as '' | 'true' | 'false', page: 1 }))}
        />
      </div>
      <Card className="overflow-hidden">
        {list.isError ? (
          <div className="p-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
        ) : (
          <DataTable
            loading={list.isPending}
            rows={list.data?.data}
            rowKey={(f) => f.id}
            empty={{ title: 'Aucun fournisseur' }}
            columns={[
              {
                key: 'nom',
                header: 'Fournisseur',
                cell: (f) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={f.nom} />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-slate-100">{f.nom}</p>
                      {f.contact && <p className="text-xs text-gray-500">{f.contact}</p>}
                    </div>
                  </div>
                ),
              },
              { key: 'tel', header: 'Téléphone', cell: (f) => f.telephone ?? '—' },
              { key: 'email', header: 'Email', cell: (f) => f.email ?? <span className="text-orange-600">À renseigner</span> },
              {
                key: 'types',
                header: 'Matériaux',
                cell: (f) =>
                  f._count.materiaux ? (
                    <span className="text-gray-600" title={`${f._count.materiaux} matériau(x) au catalogue`}>
                      {(f.materiaux ?? []).map((m) => m.nom).join(', ')}
                      {f._count.materiaux > (f.materiaux?.length ?? 0) && ` +${f._count.materiaux - (f.materiaux?.length ?? 0)}`}
                    </span>
                  ) : (
                    <span className="text-orange-600">Aucun</span>
                  ),
              },
              { key: 'delai', header: 'Délai', align: 'right', cell: (f) => (f.delaiLivraison != null ? `${f.delaiLivraison} j` : '—') },
              {
                key: 'statut',
                header: 'Statut',
                cell: (f) => (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={f.actif ? 'green' : 'slate'}>{f.actif ? 'Actif' : 'Inactif'}</Badge>
                    {f.userId ? (
                      <span title={f.utilisateur ? `Compte : ${f.utilisateur.email}` : undefined}><Badge tone="blue">Portail</Badge></span>
                    ) : (
                      <Badge tone="amber">Sans compte portail</Badge>
                    )}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                cell: (f) =>
                  isAdmin && (
                    <span className="inline-flex gap-3">
                      <button type="button" onClick={() => setEditing(f)} className="text-gray-400 hover:text-blue-600" aria-label={`Modifier ${f.nom}`}><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => setDeleting(f)} className="text-gray-400 hover:text-red-600" aria-label={`Supprimer ${f.nom}`}><Trash2 className="size-4" /></button>
                    </span>
                  ),
              },
            ]}
          />
        )}
        <Pagination meta={list.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <FournisseurModal open={editing !== null} onClose={() => setEditing(null)} fournisseur={editing === 'new' || !editing ? undefined : editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Supprimer le fournisseur"
        message="Impossible s’il fournit des matériaux ou a des commandes : désactivez-le plutôt (Modifier → « Fournisseur actif »)."
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast.success('Fournisseur supprimé'); setDeleting(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </>
  );
}
