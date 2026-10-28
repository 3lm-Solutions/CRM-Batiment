import { HardHat, CheckCircle2, Clock, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { errorMessage, toProblem } from '@/lib/api';
import { formatDate, formatEuros, formatNumber, formatUnite, fullName } from '@/lib/format';
import { usePublicAction, usePublicDevis, type PublicDevis } from './api';
import { ClientMentionsPro } from '../clients/ClientMentionsPro';

const CLOSED_MESSAGES: Record<string, string> = {
  UTILISE: 'Ce lien a déjà été utilisé. Merci pour votre réponse !',
  EXPIRE: 'Ce lien a expiré. Contactez votre conseiller pour en recevoir un nouveau.',
  ANNULE: 'Ce devis a été modifié ou annulé : ce lien n’est plus valable. Votre conseiller vous enverra la nouvelle version.',
  BLOQUE: 'Trop de codes erronés : ce lien est bloqué par sécurité. Contactez votre conseiller.',
};

function Shell({ company, children }: { company?: PublicDevis['devis']['company']; children: ReactNode }) {
  return (
    <main className="min-h-screen pb-16">
      <header className="sidebar-gradient text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-5">
          {company?.logo ? (
            <div className="flex h-10 max-w-32 items-center justify-center rounded-xl bg-white px-2"><img src={company.logo} alt={`Logo ${company.nom}`} className="max-h-8 max-w-full object-contain" /></div>
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15"><HardHat className="size-5" aria-hidden /></div>
          )}
          <div>
            <p className="text-lg font-bold">{company?.nom ?? 'Votre devis'}</p>
            {company && <p className="text-xs text-cyan-50/80">{[company.telephone, company.email].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-8">{children}</div>
    </main>
  );
}

function Banner({ tone, icon, children }: { tone: 'info' | 'success' | 'warning'; icon: ReactNode; children: ReactNode }) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${tones[tone]}`}>{icon}<div>{children}</div></div>;
}

function ValidationPanel({ token }: { token: string }) {
  const action = usePublicAction(token);
  const [refusing, setRefusing] = useState(false);
  const [motif, setMotif] = useState('');
  const [done, setDone] = useState<string | null>(null);

  if (done) return <Banner tone="success" icon={<CheckCircle2 className="size-5 shrink-0" />}>{done}</Banner>;
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Votre réponse</h2>
      <p className="mt-1 text-sm text-slate-600">Acceptez le devis pour que votre conseiller prépare la signature, ou indiquez-nous ce qui ne vous convient pas.</p>
      {refusing ? (
        <div className="mt-4 space-y-3">
          <Textarea label="Pourquoi refusez-vous ce devis ? (facultatif)" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" loading={action.isPending} onClick={() => action.mutate({ action: 'refuser', body: { motif: motif.trim() || undefined } }, { onSuccess: (r) => setDone(r.message ?? 'Réponse enregistrée.') })}>
              Confirmer le refus
            </Button>
            <Button variant="outline" onClick={() => setRefusing(false)}>Retour</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="success" size="lg" icon={<CheckCircle2 className="size-5" />} loading={action.isPending} onClick={() => action.mutate({ action: 'accepter' }, { onSuccess: (r) => setDone(r.message ?? 'Merci !') })}>
            J’accepte ce devis
          </Button>
          <Button variant="outline" size="lg" icon={<XCircle className="size-5" />} onClick={() => setRefusing(true)}>Je refuse</Button>
        </div>
      )}
      {action.isError && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage(action.error)}</p>}
    </Card>
  );
}

function SignaturePanel({ token, data }: { token: string; data: PublicDevis }) {
  const action = usePublicAction(token);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { lien } = data;

  if (done) return <Banner tone="success" icon={<CheckCircle2 className="size-5 shrink-0" />}>{done}</Banner>;

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-brand-700" /> Signature électronique</h2>

      {lien.peutSigner ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Identité confirmée. Signez dans le cadre ci-dessous.</p>
          <SignaturePad onChange={setSignature} />
          <p className="text-xs text-slate-500">En signant, vous acceptez le devis {data.devis.reference} d’un montant de {formatEuros(data.devis.totalTTC)} TTC.</p>
          <Button size="lg" disabled={!signature} loading={action.isPending} onClick={() => action.mutate({ action: 'signer', body: { signatureBase64: signature! } }, { onSuccess: (r) => setDone(r.message ?? 'Devis signé. Merci !') })}>
            Signer le devis
          </Button>
        </div>
      ) : lien.statut === 'OTP_ENVOYE' || sentTo ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate({ action: 'code/verifier', body: { code: code.trim() } });
          }}
        >
          <p className="text-sm text-slate-600">Un code à 6 chiffres vous a été envoyé{sentTo ? ` à ${sentTo}` : ' par email'}. Il est valable 10 minutes.</p>
          <Input label="Code reçu" inputMode="numeric" autoComplete="one-time-code" maxLength={6} containerClassName="max-w-40" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={code.length !== 6} loading={action.isPending}>Valider le code</Button>
            <Button variant="ghost" onClick={() => action.mutate({ action: 'code' }, { onSuccess: (r) => setSentTo(r.envoyeA ?? null) })}>Renvoyer un code</Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Pour sécuriser votre signature, nous vous envoyons d’abord un code de confirmation par email.</p>
          <Button loading={action.isPending} onClick={() => action.mutate({ action: 'code' }, { onSuccess: (r) => setSentTo(r.envoyeA ?? null) })}>Recevoir mon code</Button>
        </div>
      )}
      {action.isError && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage(action.error)}</p>}
    </Card>
  );
}

/** Public page opened from the email: /devis/lien/:token. No account needed. */
export function ClientDevisPage() {
  const token = useParams().token ?? '';
  const query = usePublicDevis(token);

  if (query.isPending) {
    return <Shell><p className="flex items-center gap-2 text-slate-500"><LoaderCircle className="size-5 animate-spin" /> Chargement de votre devis…</p></Shell>;
  }
  if (query.isError) {
    const notFound = toProblem(query.error).status === 404;
    return (
      <Shell>
        <Banner tone="warning" icon={<XCircle className="size-5 shrink-0" />}>
          {notFound ? 'Ce lien n’est pas valide. Vérifiez qu’il est complet ou contactez votre conseiller.' : errorMessage(query.error)}
        </Banner>
      </Shell>
    );
  }

  const data = query.data;
  const { devis, lien } = data;
  const closed = CLOSED_MESSAGES[lien.statut];
  const awaitingSignatureLink = lien.type === 'VALIDATION' && devis.statut === 'ACCEPTE';

  return (
    <Shell company={devis.company}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Devis {devis.reference}</h1>
          <p className="text-sm text-slate-500">
            Pour {fullName(devis.client)} · émis le {formatDate(devis.dateEnvoi ?? devis.dateCreation)}
            {devis.createur && ` · conseiller : ${devis.createur.prenom} ${devis.createur.nom}`}
          </p>
          <ClientMentionsPro client={devis.client} className="text-xs" />
        </div>
        <p className="flex items-center gap-1 text-xs text-slate-500"><Clock className="size-4" /> Lien valable jusqu’au {formatDate(lien.expiresAt)}</p>
      </div>

      {devis.statut === 'SIGNE' ? (
        <Banner tone="success" icon={<CheckCircle2 className="size-5 shrink-0" />}>Ce devis est signé. Merci pour votre confiance !</Banner>
      ) : closed ? (
        <Banner tone={lien.statut === 'UTILISE' ? 'success' : 'warning'} icon={<Clock className="size-5 shrink-0" />}>{closed}</Banner>
      ) : lien.peutRepondre ? (
        <ValidationPanel token={token} />
      ) : lien.type === 'SIGNATURE' && (lien.peutDemanderCode || lien.peutSigner) ? (
        <SignaturePanel token={token} data={data} />
      ) : awaitingSignatureLink ? (
        <Banner tone="info" icon={<CheckCircle2 className="size-5 shrink-0" />}>Vous avez accepté ce devis. Votre conseiller vous envoie le lien de signature.</Banner>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <th scope="col" className="px-4 py-3 text-left">Désignation</th>
                <th scope="col" className="px-4 py-3 text-right">Quantité</th>
                <th scope="col" className="px-4 py-3 text-right">P.U. HT</th>
                <th scope="col" className="px-4 py-3 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l) => (
                <tr key={l.ordre} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    {l.description ?? 'Prestation'}
                    {[l.dimension, l.couleur, l.finition].some(Boolean) && <span className="block text-xs text-slate-500">{[l.dimension, l.couleur, l.finition].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatNumber(l.quantite)} {formatUnite(l.unite)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatEuros(l.prixUnitaireVente)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatEuros(l.totalHT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto max-w-xs space-y-1.5 border-t border-slate-200 p-5 text-sm">
          <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatEuros(devis.totalHT)}</dd></div>
          <div className="flex justify-between"><dt>TVA ({devis.tauxTVA} %)</dt><dd className="tabular-nums">{formatEuros(devis.totalTVA)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold"><dt>Total TTC</dt><dd className="tabular-nums">{formatEuros(devis.totalTTC)}</dd></div>
        </dl>
      </Card>

      {(devis.client.adresseChantier || devis.company.siret) && (
        <p className="text-xs text-slate-500">
          {devis.client.adresseChantier && `Adresse des travaux : ${devis.client.adresseChantier}. `}
          {devis.company.siret && `${devis.company.nom} · SIRET ${devis.company.siret}${devis.company.adresse ? ` · ${devis.company.adresse}` : ''}`}
        </p>
      )}
    </Shell>
  );
}
