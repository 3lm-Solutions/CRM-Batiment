import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const COMPANY_ID = 1;

// Rappel : chaque "contenu" finit par "Mots-cles : ..." (synonymes) pour
// ameliorer le matching RAG. Ces mots-cles sont masques a l'affichage.

const documents = [
  // ================= DEVIS =================
  {
    titre: 'Différence entre devis et facture',
    categorie: 'devis',
    priorite: 10,
    contenu:
      "Le devis est une proposition commerciale envoyée avant les travaux : il présente ce qui sera réalisé, à quel prix et dans quelles conditions. La facture est le document de paiement émis après accord, selon l'avancement ou la prestation réalisée. En résumé : le devis vient avant le chantier, la facture sert à facturer le chantier. Mots-cles : difference devis facture, distinction, comparaison, ecart entre devis et facture.",
  },
  {
    titre: "Durée de validité d'un devis",
    categorie: 'devis',
    priorite: 8,
    contenu:
      "Un devis a une durée de validité indiquée dessus, souvent comprise entre 1 et 3 mois. Passé ce délai, les prix peuvent être révisés car le coût des matériaux et de la main-d'œuvre évolue. Il est recommandé de confirmer votre accord avant la date d'expiration mentionnée sur le devis. Mots-cles : devis valide combien de temps, duree de validite, validite d un devis, quand le devis expire, delai de validite, periode de validite, combien de temps un devis reste valable.",
  },
  {
    titre: 'Postes inclus dans un devis de construction',
    categorie: 'devis',
    priorite: 7,
    contenu:
      "Un devis de construction détaille généralement : les travaux à réaliser, les matériaux, la main-d'œuvre, les éléments de chiffrage du chantier, et les éventuels frais annexes (préparation, protection, déplacements). Un devis bien structuré est précis et détaillé. Des modifications en cours de chantier peuvent faire l'objet d'un avenant. Mots-cles : postes inclus devis construction, elements du devis, que contient un devis, lignes du devis, composition d un devis, ce qu il y a dans un devis.",
  },
  {
    titre: 'Étapes pour calculer un devis de peinture',
    categorie: 'devis',
    priorite: 6,
    contenu:
      "Pour calculer un devis de peinture intérieure : 1) Mesurer les surfaces à peindre (murs et plafonds). 2) Déduire les ouvertures (portes et fenêtres). 3) Estimer les quantités de peinture selon le rendement et le nombre de couches. 4) Calculer la main-d'œuvre. 5) Ajouter les frais annexes. Pour une estimation précise et personnalisée, notre équipe peut préparer votre devis. Mots-cles : comment calculer devis peinture, methode devis peinture, estimer un devis peinture, etapes devis peinture.",
  },
  {
    titre: 'Voir mes devis en cours',
    categorie: 'devis',
    priorite: 5,
    contenu:
      "Vos devis en cours sont accessibles depuis votre espace BatiCRM, dans le module dédié aux devis, où vous pouvez les créer et suivre leur avancement. Si vous souhaitez, je peux transmettre votre demande à notre équipe. Mots-cles : voir mes devis, ou trouver mes devis, liste des devis, devis en cours, consulter mes devis, retrouver mes devis.",
  },
  {
    titre: 'Modifier un devis existant',
    categorie: 'devis',
    priorite: 5,
    contenu:
      "La modification d'un devis existant se fait depuis votre espace BatiCRM, dans le module devis. Je ne peux pas modifier directement votre devis depuis ce chat, mais je peux transmettre votre demande à notre équipe qui vous accompagnera. Mots-cles : modifier mon devis, changer un devis, editer un devis, mettre a jour un devis, corriger un devis, ajouter une remise sur un devis.",
  },
  {
    titre: 'Comprendre le total HT et TTC',
    categorie: 'devis',
    priorite: 4,
    contenu:
      "Le total HT (hors taxes) correspond au montant sans la TVA. Le total TTC (toutes taxes comprises) ajoute la TVA au montant HT. Par exemple, avec une TVA de 20%, le TTC = HT + 20%. Le détail HT et TTC figure sur chaque devis et facture dans votre espace BatiCRM. Mots-cles : total ht ttc, difference ht et ttc, hors taxes, toutes taxes comprises, tva, calcul ttc, montant ht.",
  },

  // ================= MESURES / SURFACES (méthodes) =================
  {
    titre: "Calculer la surface d'un mur ou d'une pièce",
    categorie: 'mesures',
    priorite: 6,
    contenu:
      "Pour calculer une surface rectangulaire, on multiplie la longueur par la largeur (surface = longueur x largeur). Par exemple, une pièce de 5 m sur 4 m fait 20 m². Pour un mur, on multiplie sa longueur par sa hauteur. Pensez à déduire les ouvertures (portes, fenêtres) si besoin. Mots-cles : calculer surface, surface d un mur, surface d une piece, comment calculer la surface, aire, metre carre, surface au sol.",
  },
  {
    titre: "Calculer le volume d'une pièce",
    categorie: 'mesures',
    priorite: 4,
    contenu:
      "Le volume d'une pièce se calcule en multipliant la surface au sol par la hauteur (volume = longueur x largeur x hauteur). Par exemple, une pièce de 5 m x 4 m x 2,5 m fait 50 m³. Le volume est utile pour le chauffage, la ventilation ou l'isolation. Mots-cles : calculer volume, volume d une piece, comment calculer le volume, metre cube, m3, cubage.",
  },
  {
    titre: 'Mesurer une toiture inclinée',
    categorie: 'mesures',
    priorite: 4,
    contenu:
      "Pour mesurer une toiture inclinée, on ne prend pas la surface au sol mais la surface réelle des pans, qui dépend de la pente. On mesure la longueur et la largeur de chaque pan le long de l'inclinaison, puis on additionne. Pour un calcul précis, notre équipe peut vous accompagner lors d'une visite. Mots-cles : mesurer une toiture, surface toiture inclinee, calcul toiture, surface d un toit, pente de toit, pans de toiture.",
  },
  {
    titre: 'Estimer les quantités de matériaux',
    categorie: 'mesures',
    priorite: 4,
    contenu:
      "L'estimation des quantités de matériaux dépend de la surface à couvrir et du rendement du matériau (par m²). Par exemple, pour de la peinture, on divise la surface par le rendement au litre, en tenant compte du nombre de couches. Pour une estimation adaptée à votre chantier, notre équipe peut préparer un devis détaillé. Mots-cles : quantite de materiaux, combien de peinture, combien de carrelage, estimation materiaux, quantite pour surface, metrage materiaux, combien de carrelage, quantite de carrelage, carrelage pour salle de bain, 12 m2, carrelage necessaire, estimation des materiaux, materiaux pour 100 m2, materiaux pour le sol, quantite de materiaux, combien de materiaux, quantite necessaire, calcul des quantites, m2 de sol, combien de sacs, combien de litres, combien de rouleaux.",
  },

  // ================= PRIX (jamais de chiffre inventé) =================
  {
    titre: 'Estimation de prix et budget',
    categorie: 'prix',
    priorite: 10,
    contenu:
      "Le prix d'un projet dépend de plusieurs facteurs : la surface, les matériaux choisis, la main-d'œuvre, les délais et l'ampleur des travaux. Je ne peux pas donner de chiffre précis ici, mais pour une estimation fiable et personnalisée, je peux préparer votre demande de devis : notre équipe vous recontactera rapidement. Souhaitez-vous que je lance votre demande de devis ? Mots-cles : prix, budget, cout, combien ca coute, tarif, estimation, montant, quel prix, cout total, prix travaux, budget renovation, budget construction, prix renovation, cout renovation, budget maison, budget pour construire, construire une maison, cout construction maison, prix construction, budget appartement, budget studio, renovation complete, cout pour refaire, prix pour refaire, appartement ancien, estimation rapide, chiffrage, devis gratuit, prix approximatif, fourchette de prix, environ combien, quel budget prevoir, 100 m2, 120 m2, 80 m2, , prix estime, prix estimatif, refaire une salle de bain, salle de bain, refaire salle de bain, estimation rapide, studio, renovation studio, main d oeuvre vs materiaux, versus, comparaison main d oeuvre et materiaux, part main d oeuvre, part materiaux, comment calculer un devis, calcul d un devis, comment est calcule un devis, calculer devis peinture, tarifs exacts, vos tarifs, donne moi vos tarifs, donnez moi vos tarifs, grille tarifaire, liste des prix, liste de prix, tarifs precis, vos prix, montrez moi les prix, catalogue des prix, tarification.",
  },
  {
    titre: 'Prix au mètre carré',
    categorie: 'prix',
    priorite: 9,
    contenu:
      "Le prix au mètre carré varie selon le type de travaux, les matériaux et la complexité du chantier. Pour vous donner un montant juste plutôt qu'une estimation approximative, le mieux est d'établir un devis personnalisé. Souhaitez-vous que je prépare votre demande de devis ? Mots-cles : prix au metre carre, prix au m2, cout au m2, tarif au metre carre, prix par metre carre, combien le metre carre, prix moyen, prix moyen au m2, tarif moyen, cout moyen, prix peinture, prix peinture au m2, prix pose carrelage, prix carrelage au m2, prix faux plafond, prix parquet, prix placo, prix en tunisie, tunisie, dinars, prix du marche, prix actuel, cout des materiaux, prix des materiaux actuellement.",
  },
  {
    titre: "Coût de la main d'œuvre",
    categorie: 'prix',
    priorite: 7,
    contenu:
      "Le coût de la main-d'œuvre dépend du type de travaux, de leur durée et des compétences nécessaires. Pour une estimation adaptée à votre projet, notre équipe peut préparer un devis détaillé. Souhaitez-vous que je transmette votre demande ? Mots-cles : cout main d oeuvre, prix main d oeuvre, tarif ouvrier, cout horaire, prix de la pose, cout travailleurs, , vs materiaux, versus materiaux, comparaison, difference main d oeuvre materiaux, repartition du cout, part de la main d oeuvre.",
  },

  // ================= FACTURES / PAIEMENTS =================
  {
    titre: 'Comment créer une facture',
    categorie: 'factures',
    priorite: 6,
    contenu:
      "Une facture peut être créée de plusieurs façons dans BatiCRM : directement sans devis préalable, à partir d'un devis existant, ou sous forme de facture d'acompte. Vous pouvez aussi paramétrer le taux de TVA. Pour être accompagné, je peux transmettre votre demande à notre équipe. Mots-cles : comment creer une facture, faire une facture, generer une facture, emettre une facture, etablir une facture, facturation.",
  },
  {
    titre: 'Envoyer une facture par email',
    categorie: 'factures',
    priorite: 5,
    contenu:
      "Une facture peut être envoyée directement par email au client depuis BatiCRM. Vous générez la facture, complétez les informations nécessaires, puis l'envoyez au client par email en quelques clics. Notre équipe peut vous montrer la démarche si besoin. Mots-cles : envoyer facture par email, envoi facture, transmettre une facture, facture par mail, envoyer au client.",
  },
  {
    titre: 'Marquer une facture comme payée',
    categorie: 'factures',
    priorite: 5,
    contenu:
      "Vous pouvez marquer une facture comme payée depuis le module factures de BatiCRM, ce qui met à jour son statut et le suivi des paiements. Pour être guidé dans cette manipulation, notre équipe peut vous accompagner. Mots-cles : marquer facture payee, facture reglee, statut de paiement, facture encaissee, valider un paiement.",
  },
  {
    titre: 'Paiements partiels et acomptes',
    categorie: 'factures',
    priorite: 4,
    contenu:
      "BatiCRM permet de gérer les acomptes : vous pouvez générer une facture d'acompte à partir d'un devis. Pour la gestion détaillée des paiements partiels selon votre situation, notre équipe peut vous accompagner. Mots-cles : paiements partiels, paiement en plusieurs fois, acompte, facture d acompte, echelonnement, paiement echelonne.",
  },
  {
    titre: 'Suivi des paiements clients',
    categorie: 'factures',
    priorite: 5,
    contenu:
      "Le suivi des paiements se fait depuis votre espace BatiCRM, où vous pouvez visualiser les factures, les paiements reçus et les montants en attente. Notre équipe peut vous accompagner pour la mise en place. Mots-cles : suivre les paiements, suivi paiement client, paiements recus, factures impayees, gestion des paiements, encaissements.",
  },
  {
    titre: 'Voir mes revenus mensuels',
    categorie: 'factures',
    priorite: 4,
    contenu:
      "Vos revenus mensuels sont visibles via les fonctionnalités de finance et de statistiques de BatiCRM, qui donnent une vue sur ce que vous facturez et encaissez. Notre équipe peut vous orienter vers la vue la plus adaptée. Mots-cles : revenus mensuels, chiffre d affaires, ca mensuel, mes revenus, statistiques financieres, combien j ai gagne, finances.",
  },

  // ================= CHANTIERS / PROJETS =================
  {
    titre: "Suivre l'avancement d'un chantier",
    categorie: 'chantiers',
    priorite: 6,
    contenu:
      "Le suivi de chantier vous donne une visibilité sur l'avancée de chaque projet : états, statuts des interventions et organisation des équipes. Cela permet une bonne coordination entre le terrain et le bureau. Notre équipe peut vous guider. Mots-cles : suivre avancement chantier, suivi de chantier, avancement des travaux, progression chantier, etat du chantier, ou en est le chantier.",
  },
  {
    titre: "Statuts d'un chantier",
    categorie: 'chantiers',
    priorite: 5,
    contenu:
      "Un chantier passe généralement par plusieurs statuts qui reflètent son avancement : par exemple en préparation, en cours, en pause, ou terminé. Ces statuts permettent de suivre l'état de chaque intervention. Mots-cles : statuts chantier, etats d un chantier, phases chantier, etapes chantier, statut des travaux.",
  },
  {
    titre: 'Organiser les équipes sur un projet',
    categorie: 'chantiers',
    priorite: 5,
    contenu:
      "L'organisation des équipes passe par un planning qui répartit les ouvriers, sous-traitants et ressources par chantier. On peut planifier les tâches et interventions, gérer le temps de travail et transmettre aux équipes les informations utiles. Notre équipe peut vous accompagner. Mots-cles : organiser mes equipes, gestion des equipes, planifier les ouvriers, repartir les equipes, planning des equipes, affecter les ouvriers, coordonner les equipes, attribuer des taches aux ouvriers.",
  },
  {
    titre: 'Gérer plusieurs chantiers',
    categorie: 'chantiers',
    priorite: 4,
    contenu:
      "BatiCRM permet de gérer plusieurs chantiers en parallèle, chacun avec son suivi, ses équipes et son avancement. Vous gardez une vue d'ensemble sur tous vos projets en cours. Notre équipe peut vous montrer comment organiser cela. Mots-cles : plusieurs chantiers, ajouter des chantiers, gerer plusieurs projets, multi chantiers, gestion de projets multiples.",
  },
  {
    titre: 'Ajouter des photos au chantier',
    categorie: 'chantiers',
    priorite: 3,
    contenu:
      "Vous pouvez associer des photos à un chantier pour documenter l'avancement et garder une trace visuelle des travaux. Notre équipe peut vous montrer comment les ajouter depuis votre espace. Mots-cles : photos du chantier, ajouter des photos, documents chantier, images chantier, photos des travaux.",
  },
  {
    titre: 'Gérer les fournisseurs',
    categorie: 'chantiers',
    priorite: 4,
    contenu:
      "La gestion des fournisseurs se fait depuis BatiCRM : vous pouvez enregistrer vos fournisseurs, suivre les commandes et les réceptions liées à vos chantiers. Notre équipe peut vous accompagner dans la mise en place. Mots-cles : gerer les fournisseurs, gestion fournisseurs, commandes fournisseur, suivi fournisseurs, achats, approvisionnement.",
  },
  {
    titre: 'Planifier les étapes de construction',
    categorie: 'chantier',
    priorite: 8,
    contenu:
      "La planification d'un chantier suit généralement l'ordre des corps de métier : gros œuvre (fondations, murs, toiture), puis second œuvre (électricité, plomberie, isolation, plâtrerie), et enfin les finitions (peinture, revêtements, menuiseries). Dans BatiCRM, vous pouvez organiser ces étapes en tâches planifiées avec vos équipes. Notre équipe peut vous accompagner dans la mise en place du planning. Mots-cles : planifier les etapes, etapes de construction, comment planifier, planning de chantier, phases de chantier, ordre des travaux, organisation du chantier, deroulement des travaux, planning construction, etapes d un projet, phases de construction, calendrier des travaux.",
  },
  // ================= SERVICES / GÉNÉRAL =================
  {
    titre: 'Nos services',
    categorie: 'services',
    priorite: 6,
    contenu:
      "BatiCRM accompagne les professionnels du bâtiment sur l'ensemble du cycle : devis, factures, suivi de chantier, gestion des équipes et des prospects. Pour connaître nos prestations, je peux vous présenter la liste de nos services ou préparer une demande de devis. Mots-cles : vos services, quels services, que proposez vous, prestations, ce que vous faites, vos offres, domaines d intervention, types de projets.",
  },
  {
    titre: 'Demande non couverte (contact humain)',
    categorie: 'general',
    priorite: 3,
    contenu:
      "Je n'ai pas l'information précise pour répondre à cette demande. Pour ne pas vous donner une réponse erronée, le mieux est de transmettre votre question à notre équipe qui vous répondra rapidement. Souhaitez-vous que je transmette votre demande avec vos coordonnées ? Mots-cles : contact humain, parler a quelqu un, aide, autre question, besoin d aide.",
  },
];

async function main() {
  console.log('🌱 Seed RAG v3 (complet) — début');

  const deleted = await prisma.ragDocument.deleteMany({
    where: { companyId: COMPANY_ID },
  });
  console.log(`🧹 ${deleted.count} ancien(s) document(s) supprimé(s)`);

  let count = 0;
  for (const doc of documents) {
    await prisma.ragDocument.create({
      data: {
        companyId: COMPANY_ID,
        titre: doc.titre,
        categorie: doc.categorie,
        contenu: doc.contenu,
        actif: true,
        priorite: doc.priorite,
      },
    });
    count++;
  }

  console.log(`✅ ${count} document(s) RAG insérés pour la company ${COMPANY_ID}`);
  console.log('🌱 Seed RAG v3 — terminé');
}

main()
  .catch((e) => {
    console.error('Erreur seed RAG :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });