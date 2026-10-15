import type { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Starter knowledge base of the chatbot (editable in the back-office, page Assistant IA).
 * No price, margin or supplier condition: everything here can be told to a visitor.
 */
export const CONNAISSANCES = [
  {
    titre: 'Nos services',
    categorie: 'Services',
    priorite: 5,
    contenu:
      'Nous réalisons la rénovation et l’aménagement intérieur : salle de bain, cuisine, carrelage et faïence, peinture, plâtrerie et cloisons, isolation (combles, murs), électricité, plomberie, menuiserie intérieure. Nous intervenons pour les particuliers et les professionnels.',
  },
  {
    titre: 'Comment se déroule un devis',
    categorie: 'Devis',
    priorite: 5,
    contenu:
      'Le devis est gratuit et sans engagement. 1) Vous nous décrivez votre projet (ici ou par téléphone). 2) Un conseiller vous rappelle et, si nécessaire, organise une visite technique pour prendre les mesures. 3) Vous recevez votre devis détaillé par email, avec un lien sécurisé pour l’accepter puis le signer en ligne. 4) À la signature, nous planifions le chantier.',
  },
  {
    titre: 'Délais d’intervention',
    categorie: 'Délais',
    priorite: 4,
    contenu:
      'Un conseiller vous recontacte en général sous 48 heures ouvrées. Le devis est envoyé quelques jours après la visite technique. Le démarrage du chantier dépend du planning et de la disponibilité des matériaux ; la date est fixée avec vous à la signature. Pour une urgence (fuite, dégât des eaux), appelez-nous directement.',
  },
  {
    titre: 'Zone d’intervention',
    categorie: 'Zone',
    priorite: 3,
    contenu: 'Nous intervenons dans notre département et les départements limitrophes. Indiquez la ville du chantier : un conseiller vous confirme si nous pouvons intervenir.',
  },
  {
    titre: 'Garanties et assurances',
    categorie: 'Garanties',
    priorite: 3,
    contenu:
      'Nos travaux sont couverts par la garantie décennale et la garantie de parfait achèvement. Nos éventuels sous-traitants sont eux aussi assurés. Après les travaux, notre service après-vente traite vos demandes depuis votre espace client.',
  },
  {
    titre: 'Paiement',
    categorie: 'Devis',
    priorite: 2,
    contenu:
      'Un acompte est demandé à la signature du devis, puis des factures de situation peuvent suivre l’avancement des travaux pour les chantiers importants, et le solde à la réception. Les modalités exactes figurent sur votre devis.',
  },
];

export async function seedConnaissances(prisma: PrismaClient, companyId: number) {
  for (const doc of CONNAISSANCES) {
    const existing = await prisma.ragDocument.findFirst({ where: { companyId, titre: doc.titre }, select: { id: true } });
    if (!existing) await prisma.ragDocument.create({ data: { ...doc, companyId } });
  }
  return CONNAISSANCES.length;
}
