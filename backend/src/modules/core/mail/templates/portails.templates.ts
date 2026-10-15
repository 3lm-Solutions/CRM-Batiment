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
