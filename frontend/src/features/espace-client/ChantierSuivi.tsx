import { AlertTriangle, CheckCircle2, Circle, LifeBuoy, MessageSquare, Phone, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AuthImage } from '@/components/files/AuthImage';
import { Badge, Button, Card, CardHeader, Modal, Progress, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { openFichier } from '@/lib/files';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { espaceAvancementPath, useEspaceRetour, type EspaceClient, type EspacePhoto, type EspaceRetour, type EspaceSource, type RetourType } from './api';

type Chantier = EspaceClient['chantiers'][number];
type Cible = { type: RetourType; tacheId?: number; photo?: EspacePhoto; libelle: string };

const jourLong = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * A job site in the client space (Étape 5 of 26/10): progress of every task and sub-task, the
 * before / after photos validated by the chef, and the client's comments and alerts with the
 * company's answers. `token` null = office preview (read only).
 */
export function ChantierSuivi({ c, source, token, entreprise }: { c: Chantier; source: EspaceSource; token: string | null; entreprise: EspaceClient['entreprise'] }) {
  const [cible, setCible] = useState<Cible | null>(null);
  const peutEcrire = !!token && c.retoursPossibles !== false;
  const photos = c.photos ?? [];
  const retours = c.retours ?? [];
  const retoursChantier = retours.filter((r) => !r.tacheId);
  const alertesOuvertes = retours.filter((r) => r.type === 'ALERTE' && r.statut === 'OUVERT').length;

  return (
    <Card>
      <CardHeader
        title={`${c.reference} · ${c.adresse}`}
        description={`${formatDate(c.dateDebut)} → ${formatDate(c.dateFin)}`}
        actions={<StatusBadge kind="chantier" value={c.statut} />}
      />
      <div className="space-y-5 p-5">
        <Progress value={c.avancement} />
        {c.sav?.possible && (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <LifeBuoy className="size-4" /> Service après-vente disponible{c.sav.jusquau ? ` jusqu’au ${formatDate(c.sav.jusquau)}` : ''}
          </p>
        )}
        {c.chefChantier && (
          <p className="text-sm">
            Votre chef de chantier : <span className="font-medium">{fullName(c.chefChantier)}</span>
            {c.chefChantier.telephone && <a href={`tel:${c.chefChantier.telephone}`} className="ml-2 inline-flex items-center gap-1 text-brand-700 hover:underline"><Phone className="size-3.5" />{c.chefChantier.telephone}</a>}
          </p>
        )}

        {peutEcrire && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" icon={<AlertTriangle className="size-4" />} onClick={() => setCible({ type: 'ALERTE', libelle: `le chantier ${c.reference}` })}>
              Signaler un problème
            </Button>
            <Button size="sm" variant="outline" icon={<MessageSquare className="size-4" />} onClick={() => setCible({ type: 'COMMENTAIRE', libelle: `le chantier ${c.reference}` })}>
              Laisser un commentaire
            </Button>
            {alertesOuvertes > 0 && <Badge tone="red">{alertesOuvertes} signalement(s) en cours de traitement</Badge>}
          </div>
        )}
        {retoursChantier.length > 0 && <Fil retours={retoursChantier} entreprise={entreprise.nom} />}

        {c.taches.length > 0 && (
          <ul className="space-y-4">
            {c.taches.map((t) => {
              const photosTache = photos.filter((p) => p.tacheId === t.id);
              const retoursTache = retours.filter((r) => r.tacheId === t.id);
              return (
                <li key={t.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="grid items-center gap-2 sm:grid-cols-[1fr_10rem]">
                    <span className="font-medium">{t.libelle}</span>
                    <Progress value={t.avancement} />
                  </div>
                  {!!t.checklist?.length && (
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2" aria-label={`Étapes de ${t.libelle}`}>
                      {t.checklist.map((i) => (
                        <li key={i.id} className={cn('flex items-center gap-2 text-sm', i.fait ? 'text-slate-500' : 'text-slate-700 dark:text-slate-300')}>
                          {i.fait ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-slate-300" />}
                          <span className={i.fait ? 'line-through' : undefined}>{i.libelle}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {photosTache.length > 0 && (
                    <Galerie
                      photos={photosTache}
                      checklist={t.checklist ?? []}
                      source={source}
                      onCommenter={peutEcrire ? (p) => setCible({ type: 'COMMENTAIRE', tacheId: t.id, photo: p, libelle: `la photo ${p.moment === 'AVANT' ? 'avant' : 'après'} du ${formatDate(p.date)} (« ${t.libelle} »)` }) : undefined}
                    />
                  )}
                  {peutEcrire && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" icon={<MessageSquare className="size-4" />} onClick={() => setCible({ type: 'COMMENTAIRE', tacheId: t.id, libelle: `la tâche « ${t.libelle} »` })}>
                        Commenter
                      </Button>
                      <Button size="sm" variant="ghost" icon={<AlertTriangle className="size-4 text-red-600" />} onClick={() => setCible({ type: 'ALERTE', tacheId: t.id, libelle: `la tâche « ${t.libelle} »` })}>
                        Signaler un problème
                      </Button>
                    </div>
                  )}
                  {retoursTache.length > 0 && <Fil retours={retoursTache} entreprise={entreprise.nom} photos={photos} />}
                </li>
              );
            })}
          </ul>
        )}
        {!peutEcrire && token && c.retoursPossibles === false && (
          <p className="text-xs text-slate-500">Chantier clôturé : pour un problème, utilisez l’onglet « Service après-vente ».</p>
        )}
      </div>
      {token && <RetourModal cible={cible} onClose={() => setCible(null)} token={token} chantierId={c.id} source={source} />}
    </Card>
  );
}

/** Before / after photos of one task, day by day (sub-task shown under each photo). */
function Galerie({ photos, checklist, source, onCommenter }: { photos: EspacePhoto[]; checklist: { id: number; libelle: string }[]; source: EspaceSource; onCommenter?: (p: EspacePhoto) => void }) {
  const jours = [...new Set(photos.map((p) => p.date.slice(0, 10)))];
  return (
    <div className="mt-3 space-y-3">
      {jours.map((j) => (
        <div key={j}>
          <p className="mb-1.5 text-xs font-semibold capitalize text-slate-500">{jourLong(j)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['AVANT', 'APRES'] as const).map((m) => {
              const liste = photos.filter((p) => p.date.slice(0, 10) === j && p.moment === m);
              if (!liste.length) return <div key={m} className="hidden sm:block" />;
              return (
                <div key={m}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{m === 'AVANT' ? 'Avant' : 'Après'}</p>
                  <ul className="flex flex-wrap gap-2">
                    {liste.map((p) => {
                      const sousTache = checklist.find((i) => i.id === p.checklistItemId)?.libelle;
                      return (
                        <li key={p.id} className="w-28 space-y-1">
                          <AuthImage
                            path={espaceAvancementPath(source, p.id)}
                            alt={`Photo ${m === 'AVANT' ? 'avant' : 'après'}${sousTache ? ` — ${sousTache}` : ''}`}
                            className="size-28 rounded-lg"
                            onClick={() => void openFichier(p.id, espaceAvancementPath(source, p.id))}
                          />
                          {sousTache && <p className="truncate text-[11px] text-slate-500">{sousTache}</p>}
                          {onCommenter && (
                            <button type="button" className="text-[11px] font-medium text-brand-700 hover:underline dark:text-blue-300" onClick={() => onCommenter(p)}>
                              Commenter
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The client's messages and the company's answers. */
function Fil({ retours, entreprise, photos = [] }: { retours: EspaceRetour[]; entreprise: string; photos?: EspacePhoto[] }) {
  return (
    <ul className="mt-3 space-y-2" aria-label="Vos messages">
      {[...retours].reverse().map((r) => {
        const photo = r.photoId ? photos.find((p) => p.id === r.photoId) : null;
        return (
          <li key={r.id} className={cn('rounded-lg p-3 text-sm', r.type === 'ALERTE' ? 'bg-red-50 dark:bg-red-950/30' : 'bg-slate-50 dark:bg-slate-800/50')}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {r.type === 'ALERTE' ? <Badge tone="red">Problème signalé</Badge> : <Badge tone="slate">Commentaire</Badge>}
              <span>{formatDateTime(r.createdAt)}</span>
              {photo && <span>· photo {photo.moment === 'AVANT' ? 'avant' : 'après'} du {formatDate(photo.date)}</span>}
              {r.statut === 'TRAITE' ? <Badge tone="green">Traité</Badge> : <Badge tone="amber">En attente de réponse</Badge>}
            </div>
            <p className="mt-1 whitespace-pre-line">{r.message}</p>
            {r.reponse && (
              <div className="mt-2 border-l-2 border-brand-700 pl-3">
                <p className="text-xs font-semibold text-brand-700 dark:text-blue-300">{entreprise}{r.reponduLe ? ` · ${formatDateTime(r.reponduLe)}` : ''}</p>
                <p className="whitespace-pre-line">{r.reponse}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RetourModal({ cible, onClose, token, chantierId, source }: { cible: Cible | null; onClose: () => void; token: string; chantierId: number; source: EspaceSource }) {
  const envoyer = useEspaceRetour(token);
  const [message, setMessage] = useState('');
  const alerte = cible?.type === 'ALERTE';
  const fermer = () => {
    setMessage('');
    onClose();
  };
  return (
    <Modal
      open={!!cible}
      onClose={fermer}
      title={alerte ? 'Signaler un problème' : 'Laisser un commentaire'}
      description={cible ? `Au sujet de ${cible.libelle}.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={fermer}>Annuler</Button>
          <Button
            variant={alerte ? 'danger' : 'primary'}
            icon={<Send className="size-4" />}
            disabled={!message.trim()}
            loading={envoyer.isPending}
            onClick={() =>
              cible &&
              envoyer.mutate(
                { chantierId, tacheId: cible.tacheId, photoId: cible.photo?.id, type: cible.type, message: message.trim() },
                { onSuccess: (r) => { toast.success(r.message); fermer(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Envoyer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {cible?.photo && (
          <AuthImage path={espaceAvancementPath(source, cible.photo.id)} alt="Photo commentée" className="h-40 w-full rounded-lg" />
        )}
        <Textarea
          label={alerte ? 'Décrivez le problème' : 'Votre commentaire'}
          required
          rows={4}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={alerte ? 'Ex. : fissure visible sur le mur du salon, carrelage différent de celui choisi…' : 'Ex. : très bien, je préfère le joint gris…'}
        />
        {alerte && <p className="text-xs text-slate-500">Votre chef de chantier est prévenu immédiatement. Pour une urgence (fuite, danger), appelez-le aussi.</p>}
      </div>
    </Modal>
  );
}
