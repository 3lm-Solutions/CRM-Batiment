import { formatDate, formatEuros } from './format';
import { escapeHtml, layout, type RenderedMail } from './layout';

export function commandeFournisseurMail(p: {
  fournisseur: string;
  entreprise: string;
  reference: string;
  dateLivraisonPrevue: Date | null;
  lignes: { materiauNom: string; quantite: string; unite: string; prixUnitaire: number; totalHT: number }[];
  totalHT: number;
}): RenderedMail {
  const rows = p.lignes
    .map(
      (l) =>
        `<tr><td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(l.materiauNom)}</td>` +
        `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(l.quantite)} ${escapeHtml(l.unite)}</td>` +
        `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(formatEuros(l.totalHT))}</td></tr>`,
    )
    .join('');
  const subject = `Bon de commande ${p.reference} — ${p.entreprise}`;
  const html = layout(
    `Bon de commande ${p.reference}`,
    `<p>Bonjour ${escapeHtml(p.fournisseur)},</p>
     <p>Merci de bien vouloir traiter la commande suivante${
       p.dateLivraisonPrevue ? `, livraison souhaitée le ${escapeHtml(formatDate(p.dateLivraisonPrevue))}` : ''
     } :</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">
       <tr><th style="text-align:left;padding:6px;">Article</th><th style="text-align:right;padding:6px;">Quantité</th><th style="text-align:right;padding:6px;">Total HT</th></tr>
       ${rows}
       <tr><td colspan="2" style="padding:6px;text-align:right;"><strong>Total HT</strong></td><td style="padding:6px;text-align:right;"><strong>${escapeHtml(formatEuros(p.totalHT))}</strong></td></tr>
     </table>
     <p>Cordialement,<br/>${escapeHtml(p.entreprise)}</p>`,
  );
  const text = [
    `Bonjour ${p.fournisseur},`,
    `Bon de commande ${p.reference} :`,
    ...p.lignes.map((l) => `- ${l.materiauNom} : ${l.quantite} ${l.unite} (${formatEuros(l.totalHT)} HT)`),
    `Total HT : ${formatEuros(p.totalHT)}`,
  ].join('\n');
  return { subject, html, text };
}

export function factureMail(p: {
  clientNom: string;
  entreprise: string;
  reference: string;
  type: string;
  montantTTC: number;
  dateEcheance: Date | null;
}): RenderedMail {
  const subject = `${p.type} ${p.reference} — ${p.entreprise}`;
  const html = layout(
    `${p.type} ${p.reference}`,
    `<p>Bonjour ${escapeHtml(p.clientNom)},</p>
     <p>Veuillez trouver ci-dessous votre ${escapeHtml(p.type.toLowerCase())} <strong>${escapeHtml(p.reference)}</strong>
        d'un montant de <strong>${escapeHtml(formatEuros(p.montantTTC))} TTC</strong>${
          p.dateEcheance ? `, à régler avant le ${escapeHtml(formatDate(p.dateEcheance))}` : ''
        }.</p>
     <p>Le document détaillé vous est transmis par votre conseiller.</p>
     <p>Cordialement,<br/>${escapeHtml(p.entreprise)}</p>`,
  );
  const text = `${p.type} ${p.reference} : ${formatEuros(p.montantTTC)} TTC${
    p.dateEcheance ? `, à régler avant le ${formatDate(p.dateEcheance)}` : ''
  }.`;
  return { subject, html, text };
}

/**
 * Reminder for an unpaid invoice past its due date (C3 of 21/10). The tone gets firmer with
 * each level; no penalty amount is computed here (the legal mentions are on the invoice).
 */
export function factureRelanceMail(p: {
  clientNom: string;
  entreprise: string;
  entrepriseEmail: string | null;
  entrepriseTelephone: string | null;
  reference: string;
  type: string;
  montantTTC: number;
  dateEcheance: Date;
  joursRetard: number;
  niveau: number;
  communicationPaiement: string | null;
}): RenderedMail {
  const ton =
    p.joursRetard <= 0
      ? 'Nous vous rappelons simplement cette échéance.'
      : p.niveau >= 3
      ? 'Malgré nos précédents rappels, nous n’avons toujours pas reçu votre règlement. Merci de régulariser la situation sans délai.'
      : p.niveau === 2
        ? 'Sauf erreur de notre part, ce règlement ne nous est toujours pas parvenu. Merci d’y procéder dans les meilleurs délais.'
        : 'Sauf erreur de notre part, nous n’avons pas encore reçu ce règlement. S’il s’agit d’un oubli, merci d’y procéder dès que possible.';
  const subject =
    p.joursRetard <= 0
      ? `Rappel d’échéance : ${p.type.toLowerCase()} ${p.reference}`
      : `${p.niveau >= 3 ? 'Dernière relance' : 'Relance'} : ${p.type.toLowerCase()} ${p.reference} échue`;
  const contact = [p.entrepriseTelephone, p.entrepriseEmail].filter(Boolean).join(' · ');
  const html = layout(
    `${p.type} ${p.reference}`,
    `<p>Bonjour ${escapeHtml(p.clientNom)},</p>
     <p>Votre ${escapeHtml(p.type.toLowerCase())} <strong>${escapeHtml(p.reference)}</strong> d'un montant de
        <strong>${escapeHtml(formatEuros(p.montantTTC))} TTC</strong> ${
          p.joursRetard > 0
            ? `était à régler le ${escapeHtml(formatDate(p.dateEcheance))} (${p.joursRetard} jour${p.joursRetard > 1 ? 's' : ''} de retard)`
            : `est à régler avant le ${escapeHtml(formatDate(p.dateEcheance))}`
        }.</p>
     <p>${escapeHtml(ton)}</p>
     ${p.communicationPaiement ? `<p>Référence à indiquer sur votre virement : <strong>${escapeHtml(p.communicationPaiement)}</strong></p>` : ''}
     <p>Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.${contact ? ` Pour toute question : ${escapeHtml(contact)}.` : ''}</p>
     <p>Cordialement,<br/>${escapeHtml(p.entreprise)}</p>`,
  );
  const text = [
    `Bonjour ${p.clientNom},`,
    '',
    p.joursRetard > 0
      ? `${p.type} ${p.reference} : ${formatEuros(p.montantTTC)} TTC, à régler le ${formatDate(p.dateEcheance)} (${p.joursRetard} jour(s) de retard).`
      : `${p.type} ${p.reference} : ${formatEuros(p.montantTTC)} TTC, à régler avant le ${formatDate(p.dateEcheance)}.`,
    ton,
    ...(p.communicationPaiement ? [`Référence à indiquer sur votre virement : ${p.communicationPaiement}`] : []),
    'Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.',
    ...(contact ? [`Pour toute question : ${contact}.`] : []),
    '',
    p.entreprise,
  ].join('\n');
  return { subject, html, text };
}
