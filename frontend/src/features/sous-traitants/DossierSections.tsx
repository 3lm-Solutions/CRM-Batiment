import { FileText, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, Input, Modal, Select, statusOptions, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatEuros, fromDateInput, fullName, toDateInput } from '@/lib/format';
import { ACCEPTED_FILES, openFichier, useUploadFichier, validateFile } from '@/lib/files';
import { useChantiers } from '../chantiers/api';
import {
  MODE_PAIEMENT,
  toOptions,
  TYPE_ASSURANCE,
  useAddDisponibilite,
  useAddNotation,
  useAddPaiement,
  useContratAction,
  useDeleteAssurance,
  useDeleteContrat,
  useDeleteDisponibilite,
  useDeleteNotation,
  useDeletePaiement,
  useSaveAssurance,
  useSaveContrat,
  useUpdatePaiement,
  type Assurance,
  type Contrat,
  type ContratAction,
  type ModePaiement,
  type Paiement,
  type PaiementStatut,
  type SousTraitant,
  type TypeAssurance,
} from './api';
import { Note } from './SousTraitantsPage';

const onError = (e: unknown) => toast.error(errorMessage(e));
const th = 'px-4 py-3 text-left text-xs font-semibold text-slate-500';
const td = 'px-4 py-3';

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty: boolean }) {
  if (empty) return <p className="px-5 py-4 text-sm text-slate-500">Rien pour l’instant.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 dark:border-slate-800">{head.map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

/** Small "delete" icon with its confirmation. */
function DeleteButton({ label, onConfirm, loading }: { label: string; onConfirm: (done: () => void) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label={label}><Trash2 className="size-4" /></button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} danger title={label} message="Cette suppression est définitive." confirmLabel="Supprimer" loading={loading} onConfirm={() => onConfirm(() => setOpen(false))} />
    </>
  );
}

// ── assurances ────────────────────────────────────────────────────────────

function AssuranceModal({ open, onClose, st, assurance }: { open: boolean; onClose: () => void; st: SousTraitant; assurance?: Assurance }) {
  const save = useSaveAssurance(st.id);
  const upload = useUploadFichier();
  const [type, setType] = useState<TypeAssurance>(assurance?.typeAssurance ?? 'DECENNALE');
  const [numero, setNumero] = useState(assurance?.numeroAttestation ?? '');
  const [compagnie, setCompagnie] = useState(assurance?.compagnieAssurance ?? '');
  const [expiration, setExpiration] = useState(toDateInput(assurance?.dateExpiration));
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const ready = numero.trim() && compagnie.trim() && expiration && !fileError;

  const submit = () => {
    const body = { id: assurance?.id, typeAssurance: type, numeroAttestation: numero.trim(), compagnieAssurance: compagnie.trim(), dateExpiration: fromDateInput(expiration)! };
    const done = () => { toast.success('Attestation enregistrée'); onClose(); };
    if (!file) return save.mutate(body, { onSuccess: done, onError });
    upload.mutate({ file }, { onSuccess: (f) => save.mutate({ ...body, fichierId: f.id }, { onSuccess: done, onError }), onError });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={assurance ? 'Modifier l’attestation' : 'Nouvelle attestation d’assurance'}
      description="Le statut (valide, à renouveler, expirée) est calculé depuis la date d’expiration ; une alerte part 30 jours avant."
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button disabled={!ready} loading={save.isPending || upload.isPending} onClick={submit}>Enregistrer</Button></>}
    >
      <div className="space-y-4">
        <Select label="Type" options={toOptions(TYPE_ASSURANCE)} value={type} onChange={(e) => setType(e.target.value as TypeAssurance)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Compagnie" required value={compagnie} onChange={(e) => setCompagnie(e.target.value)} />
          <Input label="N° d’attestation" required value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <Input label="Date d’expiration" type="date" required value={expiration} onChange={(e) => setExpiration(e.target.value)} />
        <Input
          label="Attestation (PDF ou photo)"
          type="file"
          accept={ACCEPTED_FILES}
          error={fileError ?? undefined}
          hint={assurance?.fichierId ? 'Un fichier est déjà joint ; en choisir un autre le remplace.' : undefined}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setFileError(f ? validateFile(f) : null);
          }}
        />
      </div>
    </Modal>
  );
}

export function AssurancesSection({ st, canWrite }: { st: SousTraitant; canWrite: boolean }) {
  const remove = useDeleteAssurance(st.id);
  const [editing, setEditing] = useState<Assurance | 'new' | null>(null);
  return (
    <Card>
      <CardHeader
        title="Assurances"
        description="La décennale valide est obligatoire pour activer un contrat."
        actions={canWrite && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Ajouter</Button>}
      />
      <Table head={['Type', 'Compagnie', 'N°', 'Expire le', 'Statut', '']} empty={st.assurances.length === 0}>
        {st.assurances.map((a) => (
          <tr key={a.id}>
            <td className={`${td} font-medium`}>{TYPE_ASSURANCE[a.typeAssurance]}</td>
            <td className={td}>{a.compagnieAssurance}</td>
            <td className={td}>{a.numeroAttestation}</td>
            <td className={td}>{formatDate(a.dateExpiration)}</td>
            <td className={td}><StatusBadge kind="assurance" value={a.statut} /></td>
            <td className={`${td} whitespace-nowrap text-right`}>
              {(a.fichierId || a.documentUrl) && (
                <button
                  type="button"
                  onClick={() => (a.fichierId ? void openFichier(a.fichierId) : window.open(a.documentUrl!, '_blank', 'noopener'))}
                  className="rounded p-1 text-slate-500 hover:text-brand-700"
                  aria-label="Voir l’attestation"
                >
                  <FileText className="size-4" />
                </button>
              )}
              {canWrite && (
                <>
                  <button type="button" onClick={() => setEditing(a)} className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:underline">Modifier</button>
                  <DeleteButton label="Supprimer l’attestation" loading={remove.isPending} onConfirm={(done) => remove.mutate(a.id, { onSuccess: done, onError })} />
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {editing && <AssuranceModal open onClose={() => setEditing(null)} st={st} assurance={editing === 'new' ? undefined : editing} />}
    </Card>
  );
}

// ── contrats ──────────────────────────────────────────────────────────────

const CONTRAT_NEXT: Record<string, { action: ContratAction; label: string; danger?: boolean }[]> = {
  BROUILLON: [{ action: 'activer', label: 'Activer' }],
  ACTIF: [{ action: 'terminer', label: 'Terminer' }, { action: 'resilier', label: 'Résilier', danger: true }],
};

function ContratModal({ open, onClose, st }: { open: boolean; onClose: () => void; st: SousTraitant }) {
  const save = useSaveContrat();
  const chantiers = useChantiers({ page: 1, limit: 100, statuts: ['PLANIFIE', 'EN_COURS', 'SUSPENDU'] }, open);
  const [chantierId, setChantierId] = useState('');
  const [montant, setMontant] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const ready = chantierId && Number(montant) > 0 && !(debut && fin && fin < debut);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau contrat de sous-traitance"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!ready}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { sousTraitantId: st.id, chantierId: Number(chantierId), montantHT: Number(montant), dateDebut: fromDateInput(debut), dateFin: fromDateInput(fin) },
                { onSuccess: () => { toast.success('Contrat créé (brouillon)'); onClose(); }, onError },
              )
            }
          >
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Chantier"
          required
          placeholder="Choisir…"
          options={(chantiers.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.reference} · ${fullName(c.client)}` }))}
          value={chantierId}
          onChange={(e) => setChantierId(e.target.value)}
        />
        <Input label="Montant HT (€)" type="number" step="0.01" min={0} required value={montant} onChange={(e) => setMontant(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Début" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          <Input label="Fin" type="date" min={debut || undefined} value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

export function ContratsSection({ st, canWrite, showAmounts = true }: { st: SousTraitant; canWrite: boolean; showAmounts?: boolean }) {
  const action = useContratAction();
  const remove = useDeleteContrat();
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ contrat: Contrat; action: ContratAction } | null>(null);
  const run = (contrat: Contrat, a: ContratAction) =>
    action.mutate({ id: contrat.id, action: a }, { onSuccess: () => { toast.success('Contrat mis à jour'); setConfirm(null); }, onError });

  return (
    <Card>
      <CardHeader title="Contrats" actions={canWrite && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau contrat</Button>} />
      <Table head={['Référence', 'Chantier', ...(showAmounts ? ['Montant HT'] : []), 'Période', 'Statut', '']} empty={st.contrats.length === 0}>
        {st.contrats.map((c) => (
          <tr key={c.id}>
            <td className={`${td} font-medium`}>{c.reference}</td>
            <td className={td}><Link to={`/chantiers/${c.chantier.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{c.chantier.reference}</Link></td>
            {showAmounts && <td className={`${td} tabular-nums`}>{formatEuros(c.montantHT)}</td>}
            <td className={td}>{formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</td>
            <td className={td}><StatusBadge kind="contrat" value={c.statut} /></td>
            <td className={`${td} whitespace-nowrap text-right`}>
              {canWrite &&
                (CONTRAT_NEXT[c.statut] ?? []).map((n) => (
                  <Button
                    key={n.action}
                    size="sm"
                    variant={n.danger ? 'ghost' : 'outline'}
                    className={n.danger ? 'text-red-600' : undefined}
                    loading={action.isPending && action.variables?.id === c.id && action.variables.action === n.action}
                    onClick={() => (n.danger ? setConfirm({ contrat: c, action: n.action }) : run(c, n.action))}
                  >
                    {n.label}
                  </Button>
                ))}
              {/* Draft or cancelled, without payments (21/10) — a paid contract is accounting history */}
              {canWrite && (c.statut === 'BROUILLON' || c.statut === 'RESILIE') && (
                (st.paiements ?? []).some((p) => p.contratId === c.id) ? (
                  <span className="ml-2 text-xs text-slate-500" title="Supprimez d’abord ses paiements (onglet Paiements)">Payé : non supprimable</span>
                ) : (
                  <DeleteButton
                    label="Supprimer le contrat"
                    loading={remove.isPending}
                    onConfirm={(done) => remove.mutate(c.id, { onSuccess: () => { toast.success('Contrat supprimé'); done(); }, onError })}
                  />
                )
              )}
            </td>
          </tr>
        ))}
      </Table>
      <ContratModal open={creating} onClose={() => setCreating(false)} st={st} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger
        title="Résilier le contrat"
        message="Le contrat passe à RÉSILIÉ. Cette action est définitive."
        confirmLabel="Résilier"
        loading={action.isPending}
        onConfirm={() => confirm && run(confirm.contrat, confirm.action)}
      />
    </Card>
  );
}

// ── paiements ─────────────────────────────────────────────────────────────

function PaiementModal({ open, onClose, st, paiement }: { open: boolean; onClose: () => void; st: SousTraitant; paiement?: Paiement }) {
  const add = useAddPaiement(st.id);
  const update = useUpdatePaiement(st.id);
  const [contratId, setContratId] = useState('');
  const [ht, setHt] = useState('');
  const [ttc, setTtc] = useState('');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [mode, setMode] = useState<ModePaiement>('VIREMENT');
  const [statut, setStatut] = useState<PaiementStatut>('REGLE');

  useEffect(() => {
    if (!open) return;
    setContratId(paiement?.contratId ? String(paiement.contratId) : '');
    setHt(paiement ? String(paiement.montantHT) : '');
    setTtc(paiement ? String(paiement.montantTTC) : '');
    setDate(toDateInput(paiement ? paiement.datePaiement : new Date()));
    setMode(paiement?.modePaiement ?? 'VIREMENT');
    setStatut(paiement?.statut ?? 'REGLE');
  }, [open, paiement]);

  const ready = Number(ht) > 0 && Number(ttc) >= Number(ht) && date;
  const body = {
    contratId: contratId ? Number(contratId) : null,
    montantHT: Number(ht),
    montantTTC: Number(ttc),
    datePaiement: fromDateInput(date)!,
    modePaiement: mode,
    statut,
  };
  const submit = () =>
    paiement
      ? update.mutate({ id: paiement.id, ...body }, { onSuccess: () => { toast.success('Paiement modifié'); onClose(); }, onError })
      : add.mutate(body, { onSuccess: () => { toast.success('Paiement enregistré'); onClose(); }, onError });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={paiement ? 'Modifier le paiement' : 'Nouveau paiement'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!ready} loading={add.isPending || update.isPending} onClick={submit}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Contrat" placeholder="Hors contrat" options={st.contrats.map((c) => ({ value: c.id, label: `${c.reference} · ${c.chantier.reference}` }))} value={contratId} onChange={(e) => setContratId(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Montant HT" type="number" step="0.01" required value={ht} onChange={(e) => { setHt(e.target.value); if (!ttc) setTtc(e.target.value ? String(Math.round(Number(e.target.value) * 120) / 100) : ''); }} />
          <Input label="Montant TTC" type="number" step="0.01" required value={ttc} error={ht && ttc && Number(ttc) < Number(ht) ? 'TTC ≥ HT' : undefined} onChange={(e) => setTtc(e.target.value)} />
          <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Mode" options={toOptions(MODE_PAIEMENT)} value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} />
          <Select label="Statut" options={statusOptions('paiement')} value={statut} onChange={(e) => setStatut(e.target.value as PaiementStatut)} />
        </div>
      </div>
    </Modal>
  );
}

export function PaiementsSection({ st, canWrite }: { st: SousTraitant; canWrite: boolean }) {
  const update = useUpdatePaiement(st.id);
  const remove = useDeletePaiement(st.id);
  const [editing, setEditing] = useState<Paiement | 'new' | null>(null);
  const total = st.paiements.filter((p) => p.statut === 'REGLE').reduce((s, p) => s + p.montantTTC, 0);
  return (
    <Card>
      <CardHeader title="Paiements" description={`Réglé : ${formatEuros(total)} TTC`} actions={canWrite && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Ajouter</Button>} />
      <Table head={['Date', 'Contrat', 'HT', 'TTC', 'Mode', 'Statut', '']} empty={st.paiements.length === 0}>
        {st.paiements.map((p) => (
          <tr key={p.id}>
            <td className={td}>{formatDate(p.datePaiement)}</td>
            <td className={td}>{st.contrats.find((c) => c.id === p.contratId)?.reference ?? '—'}</td>
            <td className={`${td} tabular-nums`}>{formatEuros(p.montantHT)}</td>
            <td className={`${td} tabular-nums`}>{formatEuros(p.montantTTC)}</td>
            <td className={td}>{MODE_PAIEMENT[p.modePaiement]}</td>
            <td className={td}><StatusBadge kind="paiement" value={p.statut} /></td>
            <td className={`${td} text-right`}>
              {canWrite && (
                <span className="inline-flex items-center gap-1">
                  {p.statut === 'EN_ATTENTE' && (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, statut: 'REGLE' }, { onSuccess: () => toast.success('Paiement réglé'), onError })}>Marquer réglé</Button>
                  )}
                  <button type="button" onClick={() => setEditing(p)} className="rounded p-1 text-slate-400 hover:text-blue-600" aria-label={`Modifier le paiement du ${formatDate(p.datePaiement)}`}><Pencil className="size-4" /></button>
                  <DeleteButton
                    label="Supprimer le paiement"
                    loading={remove.isPending}
                    onConfirm={(done) => remove.mutate(p.id, { onSuccess: () => { toast.success('Paiement supprimé'); done(); }, onError })}
                  />
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <PaiementModal open={editing !== null} onClose={() => setEditing(null)} st={st} paiement={editing === 'new' ? undefined : (editing ?? undefined)} />
    </Card>
  );
}

// ── disponibilités ────────────────────────────────────────────────────────

export function DisponibilitesSection({ st, canWrite }: { st: SousTraitant; canWrite: boolean }) {
  const add = useAddDisponibilite(st.id);
  const remove = useDeleteDisponibilite(st.id);
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [disponible, setDisponible] = useState(false);
  const [notes, setNotes] = useState('');
  const ready = debut && fin && fin >= debut;
  return (
    <Card>
      <CardHeader title="Disponibilités" description="Périodes à venir (congés, autre chantier, disponibilité confirmée)" />
      <Table head={['Du', 'Au', 'État', 'Notes', '']} empty={st.disponibilites.length === 0}>
        {st.disponibilites.map((d) => (
          <tr key={d.id}>
            <td className={td}>{formatDate(d.dateDebut)}</td>
            <td className={td}>{formatDate(d.dateFin)}</td>
            <td className={td}>{d.disponible ? <span className="text-emerald-600">Disponible</span> : <span className="text-red-600">Indisponible</span>}</td>
            <td className={td}>{d.notes ?? '—'}</td>
            <td className={`${td} text-right`}>{canWrite && <DeleteButton label="Supprimer la période" loading={remove.isPending} onConfirm={(done) => remove.mutate(d.id, { onSuccess: done, onError })} />}</td>
          </tr>
        ))}
      </Table>
      {canWrite && (
        <div className="grid items-end gap-3 border-t border-slate-100 p-4 sm:grid-cols-[1fr_1fr_auto_1.5fr_auto] dark:border-slate-800">
          <Input label="Du" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          <Input label="Au" type="date" min={debut || undefined} value={fin} onChange={(e) => setFin(e.target.value)} />
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="size-4 accent-brand-700" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} /> Disponible</label>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button
            disabled={!ready}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { dateDebut: fromDateInput(debut)!, dateFin: fromDateInput(fin)!, disponible, notes: notes.trim() || null },
                { onSuccess: () => { setDebut(''); setFin(''); setNotes(''); toast.success('Période ajoutée'); }, onError },
              )
            }
          >
            Ajouter
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── évaluations ───────────────────────────────────────────────────────────

function Stars({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} sur 5`} aria-pressed={value === n} className="rounded p-0.5">
            <Star className={`size-6 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function NotationModal({ open, onClose, st }: { open: boolean; onClose: () => void; st: SousTraitant }) {
  const add = useAddNotation(st.id);
  const [chantierId, setChantierId] = useState('');
  const [qualite, setQualite] = useState(0);
  const [delai, setDelai] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const chantiers = [...new Map(st.contrats.map((c) => [c.chantier.id, c.chantier])).values()];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Évaluer le sous-traitant"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!qualite || !delai || !communication}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { chantierId: chantierId ? Number(chantierId) : null, noteQualite: qualite, noteDelai: delai, noteCommunication: communication, commentaire: commentaire.trim() || null },
                { onSuccess: () => { toast.success('Évaluation enregistrée'); onClose(); }, onError },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Chantier" placeholder="Évaluation générale" options={chantiers.map((c) => ({ value: c.id, label: c.reference }))} value={chantierId} onChange={(e) => setChantierId(e.target.value)} hint="Une seule évaluation par chantier" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Stars label="Qualité" value={qualite} onChange={setQualite} />
          <Stars label="Délais" value={delai} onChange={setDelai} />
          <Stars label="Communication" value={communication} onChange={setCommunication} />
        </div>
        <Textarea label="Commentaire" rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
      </div>
    </Modal>
  );
}

export function NotationsSection({ st, canRate, canDelete }: { st: SousTraitant; canRate: boolean; canDelete: boolean }) {
  const remove = useDeleteNotation(st.id);
  const [creating, setCreating] = useState(false);
  return (
    <Card>
      <CardHeader title="Évaluations" actions={canRate && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Évaluer</Button>} />
      <Table head={['Date', 'Chantier', 'Qualité', 'Délais', 'Comm.', 'Globale', 'Commentaire', '']} empty={st.notations.length === 0}>
        {st.notations.map((n) => (
          <tr key={n.id}>
            <td className={td}>{formatDate(n.createdAt)}</td>
            <td className={td}>{n.chantier?.reference ?? '—'}</td>
            <td className={td}>{n.noteQualite}/5</td>
            <td className={td}>{n.noteDelai}/5</td>
            <td className={td}>{n.noteCommunication}/5</td>
            <td className={`${td} font-semibold`}><Note value={n.noteGlobale} /></td>
            <td className={`${td} max-w-xs text-slate-600 dark:text-slate-400`}>{n.commentaire ?? '—'}</td>
            <td className={`${td} text-right`}>{canDelete && <DeleteButton label="Supprimer l’évaluation" loading={remove.isPending} onConfirm={(done) => remove.mutate(n.id, { onSuccess: done, onError })} />}</td>
          </tr>
        ))}
      </Table>
      <NotationModal open={creating} onClose={() => setCreating(false)} st={st} />
    </Card>
  );
}
