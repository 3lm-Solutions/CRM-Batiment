/**
 * WhatsApp sharing of a quote (05/11, re-applied 16/11): the API builds a wa.me link that
 * the advisor opens on his phone; nothing is sent by the server (no WhatsApp Business API).
 */

/** French number → international digits without « + » (06 12 34 56 78 → 33612345678). */
export function numeroWhatsapp(telephone: string | null | undefined): string | null {
  if (!telephone) return null;
  let n = telephone.replace(/[\s.\-()/]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (/^0[1-9]\d{8}$/.test(n)) n = `33${n.slice(1)}`;
  if (!/^\d{8,15}$/.test(n)) return null;
  // « +33 0612… » typed by hand
  if (n.startsWith('330') && n.length === 12) n = `33${n.slice(3)}`;
  return n;
}

export function messageWhatsapp(p: {
  clientNom: string;
  reference: string;
  totalTTC: string;
  entreprise: string;
  url: string;
}): string {
  return [
    `Bonjour ${p.clientNom},`,
    `Voici votre devis ${p.reference} (${p.totalTTC} TTC) de ${p.entreprise}.`,
    `Pour le consulter et l'accepter : ${p.url}`,
    'Merci de votre confiance.',
  ].join('\n');
}

export function lienWhatsapp(numero: string, message: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
