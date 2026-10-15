import { Ban, Copy, FilePenLine, Mail, PenLine, Printer, Send, Signature, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, ConfirmDialog, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '../auth/auth-context';
import { AWAITING_CLIENT, EDITABLE, useDeleteDevis, useDevisAction, type ActionResult, type DevisAction, type DevisDetail } from './api';

interface ActionDef {
  key: string;
  label: string;
  icon: ReactNode;
  variant?: 'primary' | 'outline' | 'danger' | 'success';
  confirm: { title: string; message: string; label: string; danger?: boolean; reason?: 'required' | 'optional' };
  run: (reason: string) => { action: DevisAction; body?: object } | 'delete';
}

/** Which actions each status offers — mirrors the API state machine (devis-status.ts). */
function actionsFor(devis: DevisDetail, isAdmin: boolean): ActionDef[] {
  const s = devis.statut;
  const list: ActionDef[] = [];
  const hasEmail = !!devis.client.email;

  if (EDITABLE.includes(s)) {
    list.push({
      key: 'envoyer',
      label: s === 'REVISE' ? 'Renvoyer au client' : 'Envoyer au client',
      icon: <Send className="size-4" />,
      variant: 'primary',
      confirm: {
        title: 'Envoyer le devis ?',
        message: hasEmail
          ? `Une version figée est enregistrée et ${devis.client.email} reçoit un lien pour accepter ou refuser. Le devis ne sera plus modifiable sans révision.`
          : 'Le client n’a pas d’adresse email : ajoutez-la sur sa fiche avant l’envoi.',
        label: 'Envoyer',
      },
      run: () => ({ action: 'envoyer' }),
    });
  }
  if (AWAITING_CLIENT.includes(s)) {
    list.push(
      {
        key: 'verbal',
        label: 'Accord verbal',
        icon: <Signature className="size-4" />,
        variant: 'success',
        confirm: {
          title: 'Constater l’accord verbal du client ?',
          message: 'Le devis passe directement à SIGNÉ avec votre signature : le chantier, la facture d’acompte et les commandes fournisseur sont créés.',
          label: 'Signer',
        },
        run: () => ({ action: 'signer-conseiller', body: { verbal: true } }),
      },
      {
        key: 'renvoyer-lien',
        label: 'Renvoyer le lien',
        icon: <Mail className="size-4" />,
        confirm: { title: 'Renvoyer le lien au client ?', message: 'Un nouveau lien est envoyé ; le précédent est désactivé.', label: 'Renvoyer' },
        run: () => ({ action: 'renvoyer-lien' }),
      },
    );
  }
  if ([...AWAITING_CLIENT, 'REFUSE'].includes(s)) {
    list.push({
      key: 'reviser',
      label: 'Réviser',
      icon: <FilePenLine className="size-4" />,
      confirm: {
        title: 'Créer une nouvelle version ?',
        message: 'Les liens déjà envoyés au client sont annulés. Vous pourrez modifier les lignes puis renvoyer le devis.',
        label: 'Réviser',
        reason: 'required',
      },
      run: (justification) => ({ action: 'reviser', body: { justification } }),
    });
  }
  if (s === 'ACCEPTE') {
    list.push(
      {
        key: 'demander-signature',
        label: 'Demander la signature',
        icon: <Mail className="size-4" />,
        variant: 'primary',
        confirm: { title: 'Envoyer le lien de signature ?', message: `Le client reçoit un lien ; il confirmera son identité avec un code envoyé à ${devis.client.email ?? 'son email'}.`, label: 'Envoyer' },
        run: () => ({ action: 'demander-signature' }),
      },
      {
        key: 'signer',
        label: devis.signatureConseillerDate ? 'Signature conseiller faite' : 'Signer (conseiller)',
        icon: <PenLine className="size-4" />,
        variant: 'success',
        confirm: {
          title: 'Apposer votre signature ?',
          message: 'Votre signature enregistrée dans votre profil est apposée. Le devis devient SIGNÉ dès que le client a signé aussi.',
          label: 'Signer',
        },
        run: () => ({ action: 'signer-conseiller', body: {} }),
      },
    );
  }
  list.push({
    key: 'dupliquer',
    label: 'Dupliquer',
    icon: <Copy className="size-4" />,
    confirm: { title: 'Dupliquer ce devis ?', message: 'Un nouveau brouillon est créé pour le même client avec les mêmes lignes.', label: 'Dupliquer' },
    run: () => ({ action: 'dupliquer' }),
  });
  if (!['SIGNE', 'ANNULE'].includes(s)) {
    list.push({
      key: 'annuler',
      label: 'Annuler',
      icon: <Ban className="size-4" />,
      variant: 'danger',
      confirm: { title: 'Annuler ce devis ?', message: 'Le devis est conservé dans l’historique mais ne pourra plus évoluer. Les liens client sont désactivés.', label: 'Annuler le devis', danger: true, reason: 'optional' },
      run: (motif) => ({ action: 'annuler', body: motif ? { motif } : {} }),
    });
  }
  if (isAdmin && s === 'BROUILLON' && (devis._count?.versions ?? 0) === 0) {
    list.push({
      key: 'delete',
      label: 'Supprimer',
      icon: <Trash2 className="size-4" />,
      variant: 'danger',
      confirm: { title: 'Supprimer ce brouillon ?', message: 'Suppression définitive (le brouillon n’a jamais été envoyé).', label: 'Supprimer', danger: true },
      run: () => 'delete',
    });
  }
  return list;
}

export function DevisActions({ devis, onLink }: { devis: DevisDetail; onLink: (url: string, emailSent?: boolean) => void }) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const action = useDevisAction(devis.id);
  const remove = useDeleteDevis();
  const [pending, setPending] = useState<ActionDef | null>(null);
  const [reason, setReason] = useState('');
  const canWrite = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');

  const close = () => {
    setPending(null);
    setReason('');
  };

  const execute = (def: ActionDef) => {
    const call = def.run(reason.trim());
    if (call === 'delete') {
      remove.mutate(devis.id, {
        onSuccess: () => { toast.success('Brouillon supprimé'); navigate('/devis'); },
        onError: (e) => toast.error(errorMessage(e)),
      });
      return;
    }
    action.mutate(call, {
      onSuccess: (r: ActionResult) => {
        close();
        if (call.action === 'dupliquer') {
          toast.success('Copie créée');
          navigate(`/devis/${r.id ?? r.devis?.id}`);
          return;
        }
        if (r.lien) onLink(r.lien.url, r.emailSent);
        if (r.emailSent === false) toast.warning('L’email n’a pas pu être envoyé : transmettez le lien manuellement.');
        toast.success(r.message ?? 'Action effectuée');
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const defs = canWrite ? actionsFor(devis, hasRole('ADMIN')) : [];

  return (
    <>
      {defs.map((def) => (
        <Button
          key={def.key}
          variant={def.variant ?? 'outline'}
          icon={def.icon}
          disabled={def.key === 'signer' && !!devis.signatureConseillerDate}
          onClick={() => setPending(def)}
        >
          {def.label}
        </Button>
      ))}
      <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer</Button>

      {pending && (
        <ConfirmDialog
          open
          onClose={close}
          onConfirm={() => {
            if (pending.confirm.reason === 'required' && !reason.trim()) return toast.error('Indiquez la raison de la révision.');
            execute(pending);
          }}
          loading={action.isPending || remove.isPending}
          danger={pending.confirm.danger}
          title={pending.confirm.title}
          message={pending.confirm.message}
          confirmLabel={pending.confirm.label}
        >
          {pending.confirm.reason && (
            <Textarea
              label={pending.confirm.reason === 'required' ? 'Raison de la révision' : 'Motif (facultatif)'}
              required={pending.confirm.reason === 'required'}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
