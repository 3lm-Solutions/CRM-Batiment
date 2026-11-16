import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, ConfirmDialog, ErrorState, Loading } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useMesPhotos, useSupprimerPhoto, type PhotoAvancement } from './api';
import { PhotosFrise } from './PhotosFrise';

const moisCourant = () => new Date().toISOString().slice(0, 7);

/** The sous-traitant's own photos on a job site, month by month, with their status (Étape 3 of 26/10). */
export function MesPhotosCard({ chantierId }: { chantierId: number }) {
  const [mois, setMois] = useState(moisCourant());
  const photos = useMesPhotos({ chantierId, mois });
  const supprimer = useSupprimerPhoto();
  const [cible, setCible] = useState<PhotoAvancement | null>(null);
  const t = photos.data?.totaux;

  return (
    <Card>
      <CardHeader
        title="Mes photos"
        description={t ? `${t.enAttente} à valider · ${t.validees} validée(s) · ${t.masquees} masquée(s)` : 'Photos avant / après envoyées'}
        actions={
          <input
            type="month"
            aria-label="Mois"
            max={moisCourant()}
            value={mois}
            onChange={(e) => setMois(e.target.value || moisCourant())}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        }
      />
      {photos.isPending ? (
        <Loading />
      ) : photos.isError ? (
        <div className="p-4"><ErrorState error={photos.error} onRetry={() => void photos.refetch()} /></div>
      ) : (
        <PhotosFrise photos={photos.data.data} onSupprimer={setCible} vide="Aucune photo ce mois-ci. Utilisez « Photos avant / après » sur une tâche." />
      )}
      <ConfirmDialog
        open={!!cible}
        onClose={() => setCible(null)}
        danger
        title="Supprimer la photo"
        message="Elle n’a pas encore été validée : elle sera supprimée définitivement."
        confirmLabel="Supprimer"
        loading={supprimer.isPending}
        onConfirm={() =>
          cible &&
          supprimer.mutate(cible.id, {
            onSuccess: () => { toast.success('Photo supprimée'); setCible(null); },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </Card>
  );
}
