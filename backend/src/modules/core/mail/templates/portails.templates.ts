import { formatDate } from './format';
import { escapeHtml, layout, type RenderedMail } from './layout';

const button = (url: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="background:#1f3a5f;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block;">${escapeHtml(label)}</a></p>`;

/** Link to the client's online space (quotes, invoices, job-site progress, after-sales). */
export function espaceClientMail(p: { clientNom: string; entreprise: string; url: string; expiresAt: Date }): RenderedMail {
  const subject = `Votre espace client — ${p.entreprise}`;
  const html = layout(
    'Votre espace client',
    `<p>Bonjour ${escapeHtml(p.clientNom)},</p>
     <p>${escapeHtml(p.entreprise)} met à votre disposition un espace en ligne pour suivre vos devis,
        vos factures et l'avancement de vos chantiers, et nous signaler un problème après travaux.</p>
     ${button(p.url, 'Ouvrir mon espace')}
     <p style="font-size:13px;color:#6b7280;">Ce lien est personnel : ne le transférez pas. Valable jusqu'au ${escapeHtml(formatDate(p.expiresAt))}.</p>`,
  );
  const text = [
    `Bonjour ${p.clientNom},`,
    '',
    `${p.entreprise} met à votre disposition un espace en ligne pour suivre vos devis, factures et chantiers.`,
    `Ouvrir mon espace : ${p.url}`,
    `Lien personnel, valable jusqu'au ${formatDate(p.expiresAt)}.`,
  ].join('\n');
  return { subject, html, text };
}

const SAV_STATUT_CLIENT: Record<string, string> = {
  OUVERT: 'enregistrée',
  EN_COURS: 'en cours de traitement',
  EN_ATTENTE_CLIENT: 'en attente de votre réponse',
  RESOLU: 'résolue',
  CLOTURE: 'clôturée',
};

/**
 * After-sales follow-up for the client (20/10): status change and/or a reply of the team.
 * No link in the email (only the hash of the client-space token is stored): the client
 * uses the personal link he already received.
 */
export function savSuiviClientMail(p: {
  clientNom: string;
  entreprise: string;
  reference: string;
  titre: string;
  statut?: string;
  message?: string | null;
  /** false: the client never received (or no longer has) a client-space link */
  avecEspaceClient?: boolean;
}): RenderedMail {
  const suite = p.avecEspaceClient === false
    ? `Pour toute question sur cette demande, contactez ${p.entreprise}.`
    : `Vous pouvez suivre son avancement et nous répondre depuis votre espace client (lien personnel reçu de ${p.entreprise}).`;
  const etat = p.statut ? SAV_STATUT_CLIENT[p.statut] ?? p.statut : null;
  const subject = etat ? `Votre demande ${p.reference} est ${etat}` : `Réponse à votre demande ${p.reference}`;
  const html = layout(
    'Suivi de votre demande',
    `<p>Bonjour ${escapeHtml(p.clientNom)},</p>
     <p>Votre demande <strong>${escapeHtml(p.reference)}</strong> — « ${escapeHtml(p.titre)} »
        ${etat ? `est désormais <strong>${escapeHtml(etat)}</strong>.` : 'a reçu une réponse.'}</p>
     ${p.message ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-left:3px solid #1f3a5f;white-space:pre-line;">${escapeHtml(p.message)}</blockquote>` : ''}
     <p>${escapeHtml(suite)}</p>`,
  );
  const text = [
    `Bonjour ${p.clientNom},`,
    '',
    `Votre demande ${p.reference} — « ${p.titre} » ${etat ? `est désormais ${etat}.` : 'a reçu une réponse.'}`,
    ...(p.message ? ['', p.message] : []),
    '',
    suite,
  ].join('\n');
  return { subject, html, text };
}
