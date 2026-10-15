import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Loading, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useUserOptions } from '../users/api';
import { useDeleteSousTraitant, useLierCompte, useSousTraitant, type SousTraitant } from './api';
import { AssurancesSection, ContratsSection, DisponibilitesSection, NotationsSection, PaiementsSection } from './DossierSections';
import { Note } from './SousTraitantsPage';
import { SousTraitantFormModal } from './SousTraitantFormModal';

type Tab = 'assurances' | 'contrats' | 'paiements' | 'disponibilites' | 'notations';

/** Links the company record to a SOUS_TRAITANT login: that account then sees this dossier's job sites in its portal. */
function CompteCard({ st, canWrite }: { st: SousTraitant; canWrite: boolean }) {
  const accounts = useUserOptions(['SOUS_TRAITANT'], canWrite);
  const lier = useLierCompte(st.id);
  const [value, setValue] = useState(st.userId ? String(st.userId) : '');
  const dirty = value !== (st.userId ? String(st.userId) : '');
  return (
    <Card>
      <CardHeader title="Accès portail" description="Compte utilisateur (rôle Sous-traitant) de cette entreprise" />
      <div className="space-y-3 p-5 text-sm">
        {st.utilisateur ? (
          <p>
            {st.utilisateur.email} {st.utilisateur.actif ? <Badge tone="green">Actif</Badge> : <Badge>Désactivé</Badge>}
          </p>
        ) : (
          <p className="text-slate-500">Aucun compte lié.</p>
        )}
        {canWrite && (
          <div className="flex items-end gap-2">
            <Select
              label="Compte"
              containerClassName="flex-1"
              placeholder="Aucun"
              options={(accounts.data ?? []).map((u) => ({ value: u.id, label: fullName(u) }))}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!dirty}
              loading={lier.isPending}
              onClick={() => lier.mutate(value ? Number(value) : null, { onSuccess: () => toast.success('Compte mis à jour'), onError: (e) => toast.error(errorMessage(e)) })}
            >
              Lier
            </Button>
          </div>
        )}
        {canWrite && <p className="text-xs text-slate-500">Créez d’abord le compte dans <Link to="/utilisateurs" className="underline">Utilisateurs</Link> avec le rôle Sous-traitant.</p>}
      </div>
    </Card>
  );
}

export function SousTraitantDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const st = useSousTraitant(id);
  const remove = useDeleteSousTraitant();
  const [tab, setTab] = useState<Tab>('assurances');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (st.isPending) return <Loading />;
  if (st.isError) return <ErrorState error={st.error} onRetry={() => void st.refetch()} />;
  const s = st.data;
  const notes = s.notations.map((n) => n.noteGlobale);
  const moyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;

  return (
    <>
      <Link to="/sous-traitants" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Sous-traitants
      </Link>
      <PageHeader
        title={s.nom}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="sousTraitant" value={s.statut} />
            {s.specialite && <span>{s.specialite}</span>}
            <Note value={moyenne} />
          </span>
        }
        actions={
          isAdmin && (
            <>
              <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Modifier</Button>
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)} aria-label="Supprimer" />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Coordonnées" />
            <dl className="space-y-2 p-5 text-sm">
              {[
                ['Contact', s.contact],
                ['Téléphone', s.telephone],
                ['Email', s.email],
                ['Adresse', s.adresse],
                ['SIRET', s.siret],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd>{v ?? '—'}</dd></div>
              ))}
            </dl>
          </Card>
          <CompteCard st={s} canWrite={isAdmin} />
        </div>
        <div className="lg:col-span-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'assurances', label: `Assurances (${s.assurances.length})` },
              { value: 'contrats', label: `Contrats (${s.contrats.length})` },
              { value: 'paiements', label: 'Paiements' },
              { value: 'disponibilites', label: 'Disponibilités' },
              { value: 'notations', label: `Évaluations (${s.notations.length})` },
            ]}
          />
          {tab === 'assurances' && <AssurancesSection st={s} canWrite={isAdmin} />}
          {tab === 'contrats' && <ContratsSection st={s} canWrite={isAdmin} />}
          {tab === 'paiements' && <PaiementsSection st={s} canWrite={isAdmin} />}
          {tab === 'disponibilites' && <DisponibilitesSection st={s} canWrite={isAdmin} />}
          {tab === 'notations' && <NotationsSection st={s} canRate={hasRole('ADMIN', 'CHEF_CHANTIER')} canDelete={isAdmin} />}
        </div>
      </div>
      <SousTraitantFormModal open={editing} onClose={() => setEditing(false)} sousTraitant={s} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        danger
        title="Supprimer le sous-traitant"
        message="Possible uniquement sans contrat ni paiement. Sinon, passez-le au statut Inactif."
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(s.id, { onSuccess: () => { toast.success('Sous-traitant supprimé'); navigate('/sous-traitants'); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </>
  );
}
