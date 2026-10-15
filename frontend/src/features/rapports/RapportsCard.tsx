import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, ErrorState, Loading, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useRapportsChantier, useReviewRapport, type Rapport } from './api';
import { RapportItem } from './RapportItem';

/** Reports sent by sous-traitants for a job site, with validate / send back. */
export function RapportsCard({ chantierId, canReview }: { chantierId: number; canReview: boolean }) {
  const rapports = useRapportsChantier(chantierId);
  const review = useReviewRapport();
  const [rejecting, setRejecting] = useState<Rapport | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const pending = rapports.data?.filter((r) => r.statut === 'SOUMIS').length ?? 0;

  const decide = (r: Rapport, decision: 'valider' | 'rejeter', comment?: string) =>
    review.mutate(
      { id: r.id, decision, commentaire: comment },
      {
        onSuccess: () => {
          toast.success(decision === 'valider' ? 'Rapport validé' : 'Rapport renvoyé au sous-traitant');
          setRejecting(null);
          setCommentaire('');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Card>
      <CardHeader title="Rapports des sous-traitants" description={pending ? `${pending} à valider` : 'Comptes rendus et photos envoyés depuis le portail'} />
      {rapports.isPending ? (
        <Loading />
      ) : rapports.isError ? (
        <div className="p-4"><ErrorState error={rapports.error} onRetry={() => void rapports.refetch()} /></div>
      ) : rapports.data.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Aucun rapport pour l’instant.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rapports.data.map((r) => (
            <RapportItem
              key={r.id}
              rapport={r}
              actions={
                canReview &&
                r.statut === 'SOUMIS' && (
                  <>
                    <Button size="sm" variant="success" icon={<Check className="size-4" />} loading={review.isPending && review.variables?.id === r.id} onClick={() => decide(r, 'valider')}>
                      Valider
                    </Button>
                    <Button size="sm" variant="outline" icon={<X className="size-4" />} onClick={() => setRejecting(r)}>À reprendre</Button>
                  </>
                )
              }
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={() => {
          if (!commentaire.trim()) return void toast.error('Indiquez ce qui est à reprendre.');
          if (rejecting) decide(rejecting, 'rejeter', commentaire.trim());
        }}
        title="Renvoyer le rapport"
        message="Le sous-traitant verra votre commentaire dans son portail."
        confirmLabel="Renvoyer"
        loading={review.isPending}
      >
        <Textarea label="Commentaire" required rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
      </ConfirmDialog>
    </Card>
  );
}
