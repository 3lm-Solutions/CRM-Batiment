import { formatDate, formatEuros } from './format';
import { escapeHtml, layout, type RenderedMail } from './layout';

interface DevisMailBase {
  clientNom: string;
  reference: string;
  totalTTC: number;
  entreprise: string;
  conseiller: string;
  url: string;
  expiresAt: Date;
}

const button = (url: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="background:#1f3a5f;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block;">${escapeHtml(label)}</a></p>`;

export function devisValidationMail(p: DevisMailBase): RenderedMail {
  const subject = `Votre devis ${p.reference} — ${p.entreprise}`;
  const html = layout(
    `Devis ${p.reference}`,
    `<p>Bonjour ${escapeHtml(p.clientNom)},</p>
     <p>${escapeHtml(p.conseiller)} vous a préparé le devis <strong>${escapeHtml(p.reference)}</strong>
        d'un montant de <strong>${escapeHtml(formatEuros(p.totalTTC))} TTC</strong>.</p>
     <p>Vous pouvez le consulter, puis l'accepter ou le refuser en ligne :</p>
     ${button(p.url, 'Consulter mon devis')}
     <p style="font-size:13px;color:#6b7280;">Lien valable jusqu'au ${escapeHtml(formatDate(p.expiresAt))}.</p>`,
  );
  const text = [
    `Bonjour ${p.clientNom},`,
    '',
    `${p.conseiller} vous a préparé le devis ${p.reference} d'un montant de ${formatEuros(p.totalTTC)} TTC.`,
    `Consultez-le, puis acceptez-le ou refusez-le en ligne : ${p.url}`,
    `Lien valable jusqu'au ${formatDate(p.expiresAt)}.`,
  ].join('\n');
  return { subject, html, text };
}

export function devisSignatureMail(p: DevisMailBase): RenderedMail {
  const subject = `Signature de votre devis ${p.reference}`;
  const html = layout(
    `Signature du devis ${p.reference}`,
    `<p>Bonjour ${escapeHtml(p.clientNom)},</p>
     <p>Merci d'avoir accepté le devis <strong>${escapeHtml(p.reference)}</strong>
        (${escapeHtml(formatEuros(p.totalTTC))} TTC). Il reste à le signer électroniquement.</p>
     <p>Un code de confirmation vous sera envoyé par email au moment de signer.</p>
     ${button(p.url, 'Signer mon devis')}
     <p style="font-size:13px;color:#6b7280;">Lien valable jusqu'au ${escapeHtml(formatDate(p.expiresAt))}.</p>`,
  );
  const text = [
    `Bonjour ${p.clientNom},`,
    '',
    `Merci d'avoir accepté le devis ${p.reference} (${formatEuros(p.totalTTC)} TTC). Il reste à le signer.`,
    `Signer : ${p.url}`,
    `Lien valable jusqu'au ${formatDate(p.expiresAt)}.`,
  ].join('\n');
  return { subject, html, text };
}

export function signatureOtpMail(p: { code: string; reference: string; validityMinutes: number }): RenderedMail {
  const subject = `Code de signature — devis ${p.reference}`;
  const html = layout(
    'Code de confirmation',
    `<p>Votre code pour signer le devis ${escapeHtml(p.reference)} :</p>
     <p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#1f3a5f;">${escapeHtml(p.code)}</p>
     <p>Il expire dans ${p.validityMinutes} minutes. Ne le communiquez à personne.</p>`,
  );
  const text = `Votre code pour signer le devis ${p.reference} : ${p.code}\nIl expire dans ${p.validityMinutes} minutes.`;
  return { subject, html, text };
}
