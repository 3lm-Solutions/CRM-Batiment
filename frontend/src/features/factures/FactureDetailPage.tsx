import { ArrowLeft, Mail, Pencil, Plus, Printer, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Input, Loading, Modal, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatEuros, formatNumber, formatPercent, fromDateInput, fullName, toDateInput } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { RelancesCard } from '../relances/RelancesCard';
import { FactureQrCodes } from './FactureQrCodes';
import {
  FACTURE_TYPE_TITLE,
  factureLabel,
  isOverdue,
  useAnnulerFacture,
  useDeleteFacture,
  useEmettreFacture,
  useEnvoyerFacture,
  useFacture,
  usePayerFacture,
  useRemoveFactureLigne,
  useSaveFactureLigne,
  useUpdateFacture,
  type Facture,
  type FactureLigne,
} from './api';

function LigneModal({ open, onClose, facture, ligne }: { open: boolean; onClose: () => void; facture: Facture; ligne?: FactureLigne }) {
  const save = useSaveFactureLigne(facture.id);
  const [description, setDescription] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState('FORFAIT');
  const [prix, setPrix] = useState('');
  useEffect(() => {
    if (!open) return;
    setDescription(ligne?.description ?? '');
    setQuantite(String(ligne?.quantite ?? 1));
    setUnite(ligne?.unite ?? 'FORFAIT');
    setPrix(ligne ? String(ligne.prixUnitaireHT) : '');
  }, [open, ligne]);

  const q = Number(quantite);
  const p = Number(prix);
  const valid = description.trim() && quantite !== '' && !Number.isNaN(q) && q !== 0 && prix !== '' && !Number.isNaN(p);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ligne ? 'Modifier la ligne' : 'Nouvelle ligne'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!valid}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { ligneId: ligne?.id, description: description.trim(), quantite: q, unite: unite.trim() || undefined, prixUnitaireHT: p },
                { onSuccess: () => { toast.success('Ligne enregistrée'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea label="Description" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Quantité" type="number" step="0.001" required value={quantite} onChange={(e) => setQuantite(e.target.value)} />
          <Input label="Unité" value={unite} onChange={(e) => setUnite(e.target.value)} />
          <Input label="Prix unitaire HT" type="number" step="0.01" required value={prix} onChange={(e) => setPrix(e.target.value)} />
        </div>
        {valid && <p className="text-right text-sm text-slate-500">Total HT : <span className="font-semibold">{formatEuros(q * p)}</span></p>}
      </div>
    </Modal>
  );
}

function ConditionsModal({ open, onClose, facture }: { open: boolean; onClose: () => void; facture: Facture }) {
  const update = useUpdateFacture(facture.id);
  const [echeance, setEcheance] = useState('');
  const [conditions, setConditions] = useState('');
  const [communication, setCommunication] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!open) return;
    setEcheance(toDateInput(facture.dateEcheance));
    setConditions(facture.conditionsPaiement ?? '');
    setCommunication(facture.communicationPaiement ?? '');
    setNotes(facture.notesLegales ?? '');
  }, [open, facture]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Conditions de paiement"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  dateEcheance: fromDateInput(echeance),
                  conditionsPaiement: conditions.trim() || null,
                  communicationPaiement: communication.trim() || null,
                  notesLegales: notes.trim() || null,
                },
                { onSuccess: () => { toast.success('Conditions enregistrées'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Date d’échéance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        <Input label="Conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Paiement à 30 jours par virement" />
        <Input label="Communication du virement" value={communication} onChange={(e) => setCommunication(e.target.value)} />
        <Textarea label="Mentions légales" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Pénalités de retard, indemnité forfaitaire de recouvrement…" />
      </div>
    </Modal>
  );
}

/** The invoice itself, as printed (browser print replaces the old PDF generation). */
function FactureDocument({ facture: f, editable, onEditLigne, onRemoveLigne }: {
  facture: Facture;
  editable: boolean;
  onEditLigne: (l?: FactureLigne) => void;
  onRemoveLigne: (l: FactureLigne) => void;
}) {
  return (
    <Card className="print-area p-6 sm:p-8">
      <div className="grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-lg font-bold">{f.companyNom ?? '—'}</p>
          {f.companyAdresse && <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{f.companyAdresse}</p>}
          <p className="text-slate-600 dark:text-slate-400">{[f.companyTelephone, f.companyEmail].filter(Boolean).join(' · ')}</p>
          {f.companySiret && <p className="text-slate-600 dark:text-slate-400">SIRET {f.companySiret}</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-4 sm:justify-self-end dark:bg-slate-800/60 print:bg-transparent">
          <p className="text-xs uppercase tracking-wide text-slate-500">Facturé à</p>
          <p className="font-semibold">{fullName({ nom: f.nomClient ?? f.devis.client.nom, prenom: f.prenomClient })}</p>
          {f.adresseClient && <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{f.adresseClient}</p>}
          {f.emailClient && <p className="text-slate-600 dark:text-slate-400">{f.emailClient}</p>}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-bold">{FACTURE_TYPE_TITLE[f.typeFacture]}{f.typeFacture === 'SITUATION' && f.numeroSituation ? ` n° ${f.numeroSituation}` : ''}</h2>
          <p className="text-sm text-slate-500">N° {factureLabel(f)} · Devis {f.referenceDevis ?? f.devis.reference}</p>
          {f.factureOrigine && <p className="text-sm text-slate-500">Annule la facture {f.factureOrigine.reference}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-slate-500">Date</dt><dd>{formatDate(f.dateEmission ?? f.date)}</dd>
          <dt className="text-slate-500">Échéance</dt><dd>{formatDate(f.dateEcheance)}</dd>
          {f.avancementCumule !== null && (<><dt className="text-slate-500">Avancement cumulé</dt><dd>{formatPercent(f.avancementCumule)}</dd></>)}
          {f.acomptePercent !== null && (<><dt className="text-slate-500">Acompte</dt><dd>{formatPercent(f.acomptePercent)}</dd></>)}
        </dl>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 dark:border-slate-700">
              <th className="py-2 pr-3">Description</th>
              <th className="px-3 py-2 text-right">Qté</th>
              <th className="px-3 py-2">Unité</th>
              <th className="px-3 py-2 text-right">PU HT</th>
              <th className="py-2 pl-3 text-right">Total HT</th>
              {editable && <th className="w-16 print:hidden" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {f.lignes.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                <td className="whitespace-pre-line py-2 pr-3">{l.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(l.quantite)}</td>
                <td className="px-3 py-2">{l.unite.toLowerCase()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatEuros(l.prixUnitaireHT)}</td>
                <td className="py-2 pl-3 text-right font-medium tabular-nums">{formatEuros(l.montantHT)}</td>
                {editable && (
                  <td className="py-2 text-right print:hidden">
                    <button type="button" onClick={() => onEditLigne(l)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Modifier la ligne"><Pencil className="size-4" /></button>
                    <button type="button" onClick={() => onRemoveLigne(l)} className="rounded p-1 text-slate-500 hover:text-red-600" aria-label="Supprimer la ligne"><Trash2 className="size-4" /></button>
                  </td>
                )}
              </tr>
            ))}
            {f.lignes.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">Aucune ligne.</td></tr>
            )}
          </tbody>
        </table>
        {editable && (
          <Button size="sm" variant="ghost" className="mt-2 print:hidden" icon={<Plus className="size-4" />} onClick={() => onEditLigne()}>Ajouter une ligne</Button>
        )}
      </div>

      <dl className="ml-auto mt-6 w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatEuros(f.montantHT)}</dd></div>
        <div className="flex justify-between"><dt>TVA {formatPercent(f.tauxTVA)}</dt><dd className="tabular-nums">{formatEuros(f.montantTVA)}</dd></div>
        <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold dark:border-slate-700"><dt>Total TTC</dt><dd className="tabular-nums">{formatEuros(f.montantTTC)}</dd></div>
      </dl>

      {(f.conditionsPaiement || f.communicationPaiement || f.notesLegales) && (
        <div className="mt-8 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {f.conditionsPaiement && <p><span className="font-semibold">Conditions :</span> {f.conditionsPaiement}</p>}
          {f.communicationPaiement && <p><span className="font-semibold">Communication :</span> {f.communicationPaiement}</p>}
          {f.notesLegales && <p className="whitespace-pre-line">{f.notesLegales}</p>}
        </div>
      )}
      <FactureQrCodes f={f} />
      {f.statut === 'PAYEE' && <p className="mt-6 text-center text-lg font-bold uppercase tracking-widest text-emerald-600">Payée le {formatDate(f.datePaiement)}</p>}
      {f.statut === 'ANNULEE' && <p className="mt-6 text-center text-lg font-bold uppercase tracking-widest text-red-600">Annulée</p>}
    </Card>
  );
}

export function FactureDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const facture = useFacture(id);
  const emettre = useEmettreFacture(id);
  const envoyer = useEnvoyerFacture(id);
  const payer = usePayerFacture(id);
  const annuler = useAnnulerFacture(id);
  const removeLigne = useRemoveFactureLigne(id);
  const remove = useDeleteFacture();

  const [ligne, setLigne] = useState<FactureLigne | 'new' | null>(null);
  const [conditions, setConditions] = useState(false);
  const [dialog, setDialog] = useState<'emettre' | 'payer' | 'annuler' | 'delete' | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [datePaiement, setDatePaiement] = useState(toDateInput(new Date()));
  const [refPaiement, setRefPaiement] = useState('');
  const [motif, setMotif] = useState('');

  if (facture.isPending) return <Loading />;
  if (facture.isError) return <ErrorState error={facture.error} onRetry={() => void facture.refetch()} />;
  const f = facture.data;
  const draft = f.statut === 'BROUILLON';
  const editable = canWrite && draft;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const close = () => setDialog(null);

  return (
    <>
      <Link to="/factures" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Factures
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <FactureDocument
          facture={f}
          editable={editable}
          onEditLigne={(l) => setLigne(l ?? 'new')}
          onRemoveLigne={(l) => removeLigne.mutate(l.id, { onSuccess: () => toast.success('Ligne supprimée'), onError })}
        />

        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader title={factureLabel(f)} description={<span className="flex flex-wrap gap-2"><StatusBadge kind="facture" value={f.statut} /><StatusBadge kind="factureType" value={f.typeFacture} />{isOverdue(f) && <Badge tone="red">En retard</Badge>}</span>} />
            <div className="space-y-2 p-4">
              <Button variant="outline" className="w-full" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
              {canWrite && draft && (
                <>
                  <Button className="w-full" icon={<Send className="size-4" />} disabled={f.lignes.length === 0} onClick={() => setDialog('emettre')}>Émettre la facture</Button>
                  <Button variant="outline" className="w-full" icon={<Pencil className="size-4" />} onClick={() => setConditions(true)}>Conditions de paiement</Button>
                  <Button variant="ghost" className="w-full text-red-600" icon={<Trash2 className="size-4" />} onClick={() => setDialog('delete')}>Supprimer le brouillon</Button>
                </>
              )}
              {canWrite && f.statut === 'ENVOYEE' && f.typeFacture !== 'AVOIR' && (
                <>
                  <Button variant="success" className="w-full" onClick={() => setDialog('payer')}>Marquer payée</Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    icon={<Mail className="size-4" />}
                    loading={envoyer.isPending}
                    onClick={() => envoyer.mutate(undefined, { onSuccess: (r) => (r.emailSent ? toast.success('Facture renvoyée au client') : toast.warning('Email non envoyé (client sans email ou serveur mail indisponible)')), onError })}
                  >
                    Renvoyer par email
                  </Button>
                </>
              )}
              {canWrite && f.statut === 'ENVOYEE' && f.typeFacture !== 'AVOIR' && (
                <Button variant="ghost" className="w-full text-red-600" onClick={() => setDialog('annuler')}>Annuler par un avoir</Button>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Suivi" />
            <dl className="space-y-2 p-4 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Devis</dt><dd><Link to={`/devis/${f.devis.id}`} className="font-medium text-brand-700 hover:underline dark:text-blue-300">{f.devis.reference}</Link></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Envoyée</dt><dd>{f.dateEnvoiClient ? `${formatDate(f.dateEnvoiClient)} · ${f.emailEnvoiClient ?? ''}` : '—'}</dd></div>
              {f.statut === 'PAYEE' && <div className="flex justify-between gap-2"><dt className="text-slate-500">Paiement</dt><dd>{formatDate(f.datePaiement)}{f.referencePaiement && ` · ${f.referencePaiement}`}</dd></div>}
              {f.avoirs.map((a) => (
                <div key={a.id} className="flex justify-between gap-2"><dt className="text-slate-500">Avoir</dt><dd><Link to={`/factures/${a.id}`} className="font-medium text-brand-700 hover:underline dark:text-blue-300">{a.reference ?? 'Brouillon'}</Link> · {formatEuros(a.montantTTC)}</dd></div>
              ))}
              {f.factureOrigine && <div className="flex justify-between gap-2"><dt className="text-slate-500">Facture annulée</dt><dd><Link to={`/factures/${f.factureOrigine.id}`} className="font-medium text-brand-700 hover:underline dark:text-blue-300">{f.factureOrigine.reference}</Link></dd></div>}
            </dl>
          </Card>
          {canWrite && f.reference && f.typeFacture !== 'AVOIR' && (
            <RelancesCard
              cible={{ factureId: f.id }}
              canRelancer={f.statut === 'ENVOYEE' && !!f.emailClient}
              description={f.statut === 'ENVOYEE' && !f.emailClient ? 'Pas d’email client : relance impossible.' : 'Automatiques après l’échéance tant qu’elle n’est pas payée'}
            />
          )}
          {draft && <p className="px-1 text-xs text-slate-500">Un brouillon n’a pas encore de numéro : il est attribué à l’émission, dans l’ordre chronologique (obligation légale). Une facture émise ne se modifie plus ; elle s’annule par un avoir.</p>}
        </div>
      </div>

      <LigneModal open={ligne !== null} onClose={() => setLigne(null)} facture={f} ligne={ligne === 'new' || !ligne ? undefined : ligne} />
      <ConditionsModal open={conditions} onClose={() => setConditions(false)} facture={f} />

      <ConfirmDialog
        open={dialog === 'emettre'}
        onClose={close}
        title="Émettre la facture"
        message="La facture reçoit son numéro définitif et ne pourra plus être modifiée."
        confirmLabel="Émettre"
        loading={emettre.isPending}
        onConfirm={() =>
          emettre.mutate(sendEmail, {
            onSuccess: (r) => {
              toast.success(`Facture ${r.facture.reference} émise`);
              if (sendEmail && !r.emailSent) toast.warning('Email non envoyé : vous pourrez la renvoyer plus tard.');
              close();
            },
            onError,
          })
        }
      >
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand-700" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Envoyer par email au client</label>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'payer'}
        onClose={close}
        title="Enregistrer le paiement"
        message={`Montant : ${formatEuros(f.montantTTC)} TTC`}
        confirmLabel="Marquer payée"
        loading={payer.isPending}
        onConfirm={() =>
          payer.mutate(
            { datePaiement: fromDateInput(datePaiement) ?? undefined, referencePaiement: refPaiement.trim() || null },
            { onSuccess: () => { toast.success('Paiement enregistré'); close(); }, onError },
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Date de paiement" type="date" value={datePaiement} max={toDateInput(new Date())} onChange={(e) => setDatePaiement(e.target.value)} />
          <Input label="Référence" value={refPaiement} onChange={(e) => setRefPaiement(e.target.value)} placeholder="VIR-…" />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'annuler'}
        onClose={close}
        danger
        title="Annuler la facture"
        message="Un avoir du même montant est émis et la facture passe à ANNULÉE. C’est la seule façon légale d’annuler une facture émise."
        confirmLabel="Émettre l’avoir"
        loading={annuler.isPending}
        onConfirm={() =>
          annuler.mutate(motif.trim() || undefined, {
            onSuccess: (r) => {
              toast.success('Facture annulée');
              close();
              if (r.avoir) navigate(`/factures/${r.avoir.id}`);
            },
            onError,
          })
        }
      >
        <Textarea label="Motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        danger
        title="Supprimer le brouillon"
        message="Le brouillon est supprimé définitivement (aucun numéro n’a été consommé)."
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(f.id, { onSuccess: () => { toast.success('Brouillon supprimé'); navigate('/factures'); }, onError })}
      />
    </>
  );
}
