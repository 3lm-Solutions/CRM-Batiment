import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  ChantierStatut,
  CommandeFournisseurStatut,
  DemoRequestStatut,
  DemandeStatut,
  DevisStatut,
  FactureStatut,
  LeadSource,
  PrismaClient,
  Role,
  SavTicketCategorie,
  SavTicketPriorite,
  SavTicketStatut,
  TacheStatut,
  Unite,
} from '../generated/prisma/client.js';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL est absente du fichier .env du backend.');
}

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

async function upsertUser(input: {
  companyId: number;
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: Role;
  telephone?: string;
}) {
  const password = await bcrypt.hash(input.password, 12);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      companyId: input.companyId,
      nom: input.nom,
      prenom: input.prenom,
      role: input.role,
      telephone: input.telephone,
      actif: true,
      mustChangePassword: false,
      password,
    },
    create: {
      companyId: input.companyId,
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      password,
      role: input.role,
      telephone: input.telephone,
      actif: true,
      mustChangePassword: false,
    },
  });
}

async function upsertClient(input: {
  companyId: number;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  adresseClient: string;
  adresseChantier: string;
  source: LeadSource;
  typeProjetId: number;
  besoin: string;
}) {
  const existing = await prisma.client.findFirst({
    where: { companyId: input.companyId, email: input.email },
  });
  if (existing) {
    return prisma.client.update({ where: { id: existing.id }, data: input });
  }
  return prisma.client.create({ data: input });
}

async function upsertTask(input: {
  chantierId: number;
  libelle: string;
  description: string;
  statut: TacheStatut;
  dateDebut: Date;
  dateFin: Date;
  avancement: number;
  commentaire?: string | null;
  ordre: number;
}) {
  const existing = await prisma.tache.findFirst({
    where: { chantierId: input.chantierId, libelle: input.libelle },
  });
  if (existing) {
    return prisma.tache.update({ where: { id: existing.id }, data: input });
  }
  return prisma.tache.create({ data: input });
}

async function upsertDocument(input: {
  chantierId: number;
  nom: string;
  type: string;
  url: string;
}) {
  const existing = await prisma.documentChantier.findFirst({
    where: { chantierId: input.chantierId, nom: input.nom },
  });
  if (existing) {
    return prisma.documentChantier.update({ where: { id: existing.id }, data: input });
  }
  return prisma.documentChantier.create({ data: input });
}

async function main() {
  console.log('\n🧪 Création du jeu de données QA CRM Bâtiment...\n');

  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@batiment-pro.fr' },
    include: { company: true },
  });

  const company = existingAdmin?.company ??
    (await prisma.company.upsert({
      where: { siret: '12345678901234' },
      update: {
        nom: 'Bâtiment Pro SARL',
        email: 'contact@batiment-pro.fr',
        telephone: '0145678900',
      },
      create: {
        nom: 'Bâtiment Pro SARL',
        siret: '12345678901234',
        adresse: '123 Rue de la Construction, 75001 Paris',
        telephone: '0145678900',
        email: 'contact@batiment-pro.fr',
        tvaDefaut: 20,
        devise: 'EUR',
      },
    }));

  const [admin, technico, assistante, chef, sousTraitant] = await Promise.all([
    upsertUser({ companyId: company.id, email: 'admin@batiment-pro.fr', password: 'Admin@2026!', nom: 'Admin', prenom: 'Super', role: Role.ADMIN }),
    upsertUser({ companyId: company.id, email: 'technico@batiment-pro.fr', password: 'Technico@2026!', nom: 'Dupont', prenom: 'Marc', role: Role.TECHNICO, telephone: '0678901234' }),
    upsertUser({ companyId: company.id, email: 'assistante@batiment-pro.fr', password: 'Assistante@2026!', nom: 'Martin', prenom: 'Sophie', role: Role.ASSISTANTE, telephone: '0611223344' }),
    upsertUser({ companyId: company.id, email: 'chef.chantier@batiment-pro.fr', password: 'ChefChantier@2026!', nom: 'Bernard', prenom: 'Julien', role: Role.CHEF_CHANTIER, telephone: '0655667788' }),
    upsertUser({ companyId: company.id, email: 'sous.traitant@batiment-pro.fr', password: 'SousTraitant@2026!', nom: 'Moreau', prenom: 'Lucas', role: Role.SOUS_TRAITANT, telephone: '0699887766' }),
  ]);

  const [typeSalleDeBain, typeCuisine] = await Promise.all([
    prisma.typeProjet.upsert({
      where: { companyId_nom: { companyId: company.id, nom: 'Rénovation salle de bain' } },
      update: { actif: true },
      create: { companyId: company.id, nom: 'Rénovation salle de bain', description: 'Rénovation complète d’une salle de bain.' },
    }),
    prisma.typeProjet.upsert({
      where: { companyId_nom: { companyId: company.id, nom: 'Rénovation cuisine' } },
      update: { actif: true },
      create: { companyId: company.id, nom: 'Rénovation cuisine', description: 'Rénovation complète d’une cuisine.' },
    }),
  ]);

  const categorie = await prisma.categoriePrestation.upsert({
    where: { companyId_nom: { companyId: company.id, nom: 'Revêtements' } },
    update: { actif: true },
    create: { companyId: company.id, nom: 'Revêtements', description: 'Revêtements muraux et sols.' },
  });

  const sousCategorie = await prisma.sousCategorie.upsert({
    where: { categorieId_nom: { categorieId: categorie.id, nom: 'Carrelage mural' } },
    update: { actif: true },
    create: { companyId: company.id, categorieId: categorie.id, nom: 'Carrelage mural', description: 'Pose et finition de carrelage mural.' },
  });

  let fournisseur = await prisma.fournisseur.findFirst({ where: { companyId: company.id, nom: 'Céramique Plus' } });
  fournisseur = fournisseur
    ? await prisma.fournisseur.update({ where: { id: fournisseur.id }, data: { contact: 'Salma Jaziri', email: 'fournisseur.tests+crm@example.com', telephone: '71111222', typesMateriaux: 'Carrelage, colle, joints', delaiLivraison: 5, actif: true } })
    : await prisma.fournisseur.create({ data: { companyId: company.id, nom: 'Céramique Plus', contact: 'Salma Jaziri', email: 'fournisseur.tests+crm@example.com', telephone: '71111222', typesMateriaux: 'Carrelage, colle, joints', delaiLivraison: 5, actif: true } });

  let materiau = await prisma.materiau.findFirst({ where: { companyId: company.id, nom: 'Carrelage mural blanc 30x60' } });
  materiau = materiau
    ? await prisma.materiau.update({ where: { id: materiau.id }, data: { couleur: 'Blanc', finition: 'Mate', unite: Unite.M2, prixAchatFixe: 35, fournisseurId: fournisseur.id, actif: true } })
    : await prisma.materiau.create({ data: { companyId: company.id, nom: 'Carrelage mural blanc 30x60', couleur: 'Blanc', finition: 'Mate', unite: Unite.M2, prixAchatFixe: 35, fournisseurId: fournisseur.id, actif: true } });

  let mainOeuvre = await prisma.serviceMainOeuvre.findFirst({ where: { companyId: company.id, nom: 'Pose carrelage mural' } });
  mainOeuvre = mainOeuvre
    ? await prisma.serviceMainOeuvre.update({ where: { id: mainOeuvre.id }, data: { unite: Unite.M2, prixUnitaire: 22, productiviteJour: 12, actif: true } })
    : await prisma.serviceMainOeuvre.create({ data: { companyId: company.id, nom: 'Pose carrelage mural', unite: Unite.M2, prixUnitaire: 22, productiviteJour: 12, actif: true } });

  let prestation = await prisma.prestation.findFirst({ where: { companyId: company.id, nom: 'Fourniture et pose carrelage mural' } });
  prestation = prestation
    ? await prisma.prestation.update({ where: { id: prestation.id }, data: { categorieId: categorie.id, sousCategorieId: sousCategorie.id, unite: Unite.M2, prixVenteMin: 65, prixVenteMax: 85, actif: true } })
    : await prisma.prestation.create({ data: { companyId: company.id, categorieId: categorie.id, sousCategorieId: sousCategorie.id, nom: 'Fourniture et pose carrelage mural', unite: Unite.M2, prixVenteMin: 65, prixVenteMax: 85, description: 'Fourniture et pose complète du carrelage mural.', actif: true } });

  await prisma.prestationComposition.deleteMany({ where: { prestationId: prestation.id } });
  await prisma.prestationComposition.createMany({ data: [
    { prestationId: prestation.id, materiauId: materiau.id, quantiteParUnite: 1.05 },
    { prestationId: prestation.id, serviceMainOeuvreId: mainOeuvre.id, quantiteParUnite: 1 },
  ] });

  const [amina, hatem, leila] = await Promise.all([
    upsertClient({ companyId: company.id, email: 'amina.tests+crm@example.com', nom: 'Ben Salah', prenom: 'Amina', telephone: '20111222', adresseClient: '12 rue des Jasmins, Tunis', adresseChantier: '8 avenue Habib Bourguiba, La Marsa', source: LeadSource.SITE_WEB, typeProjetId: typeSalleDeBain.id, besoin: 'Remplacer la baignoire par une douche italienne et rénover les revêtements.' }),
    upsertClient({ companyId: company.id, email: 'hatem.tests+crm@example.com', nom: 'Trabelsi', prenom: 'Hatem', telephone: '22333444', adresseClient: '5 rue de Carthage, Tunis', adresseChantier: '22 rue du Lac, Les Berges du Lac', source: LeadSource.APPEL, typeProjetId: typeCuisine.id, besoin: 'Rénover une cuisine complète de 14 m².' }),
    upsertClient({ companyId: company.id, email: 'leila.tests+crm@example.com', nom: 'Gharbi', prenom: 'Leïla', telephone: '24555666', adresseClient: '10 avenue de France, Ariana', adresseChantier: '10 avenue de France, Ariana', source: LeadSource.RECOMMANDATION, typeProjetId: typeSalleDeBain.id, besoin: 'Demande administrative de test.' }),
  ]);

  const demandeAmina = await prisma.demandeDevis.upsert({
    where: { reference: 'DEM-QA-001' },
    update: { companyId: company.id, clientId: amina.id, createurId: technico.id, statut: DemandeStatut.EN_COURS },
    create: { companyId: company.id, clientId: amina.id, createurId: technico.id, reference: 'DEM-QA-001', source: LeadSource.SITE_WEB, description: 'Remplacement baignoire par douche italienne, carrelage mural, meuble vasque et éclairage. Budget indicatif : 18 000 TND.', statut: DemandeStatut.EN_COURS },
  });

  const demandeHatem = await prisma.demandeDevis.upsert({
    where: { reference: 'DEM-QA-002' },
    update: { companyId: company.id, clientId: hatem.id, createurId: technico.id, statut: DemandeStatut.EN_COURS },
    create: { companyId: company.id, clientId: hatem.id, createurId: technico.id, reference: 'DEM-QA-002', source: LeadSource.APPEL, description: 'Cuisine complète 14 m², meubles, plan de travail, plomberie et électricité.', statut: DemandeStatut.EN_COURS },
  });

  const devisAmina = await prisma.devis.upsert({
    where: { reference: 'DEV-QA-001' },
    update: { companyId: company.id, clientId: amina.id, demandeDevisId: demandeAmina.id, createurId: technico.id, statut: DevisStatut.ACCEPTE, totalHT: 15000, totalTVA: 3000, totalTTC: 18000, coutTotal: 11400, profit: 3600, margePourcent: 24, tauxTVA: 20 },
    create: { companyId: company.id, clientId: amina.id, demandeDevisId: demandeAmina.id, createurId: technico.id, reference: 'DEV-QA-001', statut: DevisStatut.ACCEPTE, totalHT: 15000, totalTVA: 3000, totalTTC: 18000, coutTotal: 11400, profit: 3600, margePourcent: 24, tauxTVA: 20, notes: 'Jeu de données QA — validité 30 jours.' },
  });

  const devisHatem = await prisma.devis.upsert({
    where: { reference: 'DEV-QA-002' },
    update: { companyId: company.id, clientId: hatem.id, demandeDevisId: demandeHatem.id, createurId: technico.id, statut: DevisStatut.REFUSE, totalHT: 23750, totalTVA: 4750, totalTTC: 28500, coutTotal: 19000, profit: 4750, margePourcent: 20 },
    create: { companyId: company.id, clientId: hatem.id, demandeDevisId: demandeHatem.id, createurId: technico.id, reference: 'DEV-QA-002', statut: DevisStatut.REFUSE, totalHT: 23750, totalTVA: 4750, totalTTC: 28500, coutTotal: 19000, profit: 4750, margePourcent: 20, notes: 'Refus client — budget à revoir.' },
  });

  await prisma.ligneDevis.deleteMany({ where: { devisId: devisAmina.id } });
  await prisma.ligneDevis.createMany({ data: [
    { devisId: devisAmina.id, prestationId: prestation.id, materiauId: materiau.id, serviceMainOeuvreId: mainOeuvre.id, description: 'Fourniture et pose carrelage mural', quantite: 50, unite: Unite.M2, prixUnitaireVente: 80, prixAchat: 35, mainOeuvre: 22, totalHT: 4000, coutTotal: 2850, ordre: 1 },
    { devisId: devisAmina.id, description: 'Douche italienne et plomberie', quantite: 1, unite: Unite.FORFAIT, prixUnitaireVente: 11000, prixAchat: 6500, mainOeuvre: 2050, totalHT: 11000, coutTotal: 8550, ordre: 2 },
  ] });

  const now = new Date();
  const factureAmina = await prisma.facture.upsert({
    where: { reference: 'FACT-QA-001' },
    update: { devisId: devisAmina.id, montantHT: 15000, montantTVA: 3000, montantTTC: 18000, statut: FactureStatut.ENVOYEE, dateEcheance: addDays(now, -5), emailClient: amina.email, nomClient: amina.nom, prenomClient: amina.prenom, referenceDevis: devisAmina.reference },
    create: { devisId: devisAmina.id, reference: 'FACT-QA-001', montantHT: 15000, montantTVA: 3000, montantTTC: 18000, statut: FactureStatut.ENVOYEE, dateEcheance: addDays(now, -5), emailClient: amina.email, nomClient: amina.nom, prenomClient: amina.prenom, referenceDevis: devisAmina.reference, tauxTVA: 20, companyNom: company.nom },
  });

  await prisma.facture.upsert({
    where: { reference: 'FACT-QA-002' },
    update: { devisId: devisHatem.id, montantHT: 23750, montantTVA: 4750, montantTTC: 28500, statut: FactureStatut.PAYEE, datePaiement: addDays(now, -2), emailClient: hatem.email, nomClient: hatem.nom, prenomClient: hatem.prenom, referenceDevis: devisHatem.reference },
    create: { devisId: devisHatem.id, reference: 'FACT-QA-002', montantHT: 23750, montantTVA: 4750, montantTTC: 28500, statut: FactureStatut.PAYEE, datePaiement: addDays(now, -2), emailClient: hatem.email, nomClient: hatem.nom, prenomClient: hatem.prenom, referenceDevis: devisHatem.reference, tauxTVA: 20, companyNom: company.nom },
  });

  const chantierAmina = await prisma.chantier.upsert({
    where: { reference: 'CHANT-QA-001' },
    update: { companyId: company.id, clientId: amina.id, chefChantierId: chef.id, adresse: amina.adresseChantier ?? 'La Marsa', statut: ChantierStatut.PLANIFIE, dateDebut: addDays(now, 1), dateFin: addDays(now, 30) },
    create: { companyId: company.id, clientId: amina.id, chefChantierId: chef.id, reference: 'CHANT-QA-001', adresse: amina.adresseChantier ?? 'La Marsa', description: 'Rénovation salle de bain — jeu QA', statut: ChantierStatut.PLANIFIE, dateDebut: addDays(now, 1), dateFin: addDays(now, 30) },
  });

  const chantierHatem = await prisma.chantier.upsert({
    where: { reference: 'CHANT-QA-002' },
    update: { companyId: company.id, clientId: hatem.id, chefChantierId: null, adresse: hatem.adresseChantier ?? 'Les Berges du Lac', statut: ChantierStatut.VISITE_TECHNIQUE },
    create: { companyId: company.id, clientId: hatem.id, reference: 'CHANT-QA-002', adresse: hatem.adresseChantier ?? 'Les Berges du Lac', description: 'Chantier non affecté — test d’isolation', statut: ChantierStatut.VISITE_TECHNIQUE },
  });

  await Promise.all([
    prisma.devis.update({ where: { id: devisAmina.id }, data: { chantierId: chantierAmina.id } }),
    prisma.devis.update({ where: { id: devisHatem.id }, data: { chantierId: chantierHatem.id } }),
  ]);

  const commandesReceptionQa = [
    {
      reference: 'CMD-QA-001',
      statutLivraison: CommandeFournisseurStatut.CREEE,
      date: addDays(now, -2),
      dateEnvoi: null,
      dateLivraisonPrevue: addDays(now, 5),
      notes: 'Commande QA à confirmer par le Chef de chantier.',
      quantite: 50,
      prixUnitaire: 35,
      receptions: [],
    },
    {
      reference: 'CMD-QA-002',
      statutLivraison: CommandeFournisseurStatut.PARTIELLE,
      date: addDays(now, -8),
      dateEnvoi: addDays(now, -7),
      dateLivraisonPrevue: addDays(now, 1),
      notes: 'Commande QA avec une réception partielle.',
      quantite: 30,
      prixUnitaire: 35,
      receptions: [
        {
          dateReception: addDays(now, -1),
          quantiteRecue: 12,
          quantiteAttendue: 30,
          partielle: true,
          notes: 'Première livraison partielle — 12 m² reçus.',
        },
      ],
    },
    {
      reference: 'CMD-QA-003',
      statutLivraison: CommandeFournisseurStatut.RECUE,
      date: addDays(now, -14),
      dateEnvoi: addDays(now, -13),
      dateLivraisonPrevue: addDays(now, -3),
      notes: 'Commande QA entièrement réceptionnée en deux livraisons.',
      quantite: 20,
      prixUnitaire: 35,
      receptions: [
        {
          dateReception: addDays(now, -5),
          quantiteRecue: 8,
          quantiteAttendue: 20,
          partielle: true,
          notes: 'Première livraison — 8 m² reçus.',
        },
        {
          dateReception: addDays(now, -3),
          quantiteRecue: 12,
          quantiteAttendue: 20,
          partielle: false,
          notes: 'Solde de la commande — réception complète.',
        },
      ],
    },
  ];

  for (const commandeQa of commandesReceptionQa) {
    const commande = await prisma.commandeFournisseur.upsert({
      where: { reference: commandeQa.reference },
      update: {
        devisId: devisAmina.id,
        fournisseurId: fournisseur.id,
        date: commandeQa.date,
        statutLivraison: commandeQa.statutLivraison,
        dateEnvoi: commandeQa.dateEnvoi,
        dateLivraisonPrevue: commandeQa.dateLivraisonPrevue,
        notes: commandeQa.notes,
      },
      create: {
        devisId: devisAmina.id,
        fournisseurId: fournisseur.id,
        reference: commandeQa.reference,
        date: commandeQa.date,
        statutLivraison: commandeQa.statutLivraison,
        dateEnvoi: commandeQa.dateEnvoi,
        dateLivraisonPrevue: commandeQa.dateLivraisonPrevue,
        notes: commandeQa.notes,
      },
    });

    await prisma.reception.deleteMany({
      where: { commandeFournisseurId: commande.id },
    });
    await prisma.ligneCommandeFournisseur.deleteMany({
      where: { commandeFournisseurId: commande.id },
    });

    await prisma.ligneCommandeFournisseur.create({
      data: {
        commandeFournisseurId: commande.id,
        materiauNom: materiau.nom,
        quantite: commandeQa.quantite,
        unite: Unite.M2,
        prixUnitaire: commandeQa.prixUnitaire,
        totalHT: commandeQa.quantite * commandeQa.prixUnitaire,
      },
    });

    if (commandeQa.receptions.length > 0) {
      await prisma.reception.createMany({
        data: commandeQa.receptions.map((reception) => ({
          commandeFournisseurId: commande.id,
          ...reception,
        })),
      });
    }
  }

  const [taskChef, taskCarrelage, taskVasque, taskIsolation] = await Promise.all([
    upsertTask({ chantierId: chantierAmina.id, libelle: 'Préparation et sécurisation du chantier', description: 'Protection des zones et préparation du chantier.', statut: TacheStatut.A_FAIRE, dateDebut: addDays(now, 1), dateFin: addDays(now, 3), avancement: 0, ordre: 1 }),
    upsertTask({ chantierId: chantierAmina.id, libelle: 'Pose du carrelage mural', description: 'Pose du carrelage mural blanc 30x60.', statut: TacheStatut.A_FAIRE, dateDebut: addDays(now, 7), dateFin: addDays(now, 12), avancement: 0, ordre: 2 }),
    upsertTask({ chantierId: chantierAmina.id, libelle: 'Installation meuble vasque', description: 'Montage, réglage et raccordement.', statut: TacheStatut.BLOQUEE, dateDebut: addDays(now, 13), dateFin: addDays(now, 16), avancement: 25, commentaire: 'En attente de livraison du meuble.', ordre: 3 }),
    upsertTask({ chantierId: chantierHatem.id, libelle: 'Mesures cuisine', description: 'Relevé des dimensions de la cuisine.', statut: TacheStatut.A_FAIRE, dateDebut: addDays(now, 2), dateFin: addDays(now, 3), avancement: 0, ordre: 1 }),
  ]);

  await prisma.affectationTache.deleteMany({ where: { tacheId: { in: [taskChef.id, taskCarrelage.id, taskVasque.id, taskIsolation.id] } } });
  await prisma.affectationTache.createMany({ data: [
    { tacheId: taskChef.id, userId: chef.id },
    { tacheId: taskCarrelage.id, userId: sousTraitant.id },
    { tacheId: taskVasque.id, userId: sousTraitant.id },
  ] });

  const storageRoot = resolve(process.cwd(), 'storage', 'sous-traitant');
  await mkdir(storageRoot, { recursive: true });
  await writeFile(resolve(storageRoot, 'qa_rapport_initial.md'), '# Rapport initial QA\n\nLe chantier a été préparé pour les tests manuels.\n', 'utf8');
  const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
  await writeFile(resolve(storageRoot, 'qa_photo_avant.png'), onePixelPng);

  await Promise.all([
    upsertDocument({ chantierId: chantierAmina.id, nom: 'Rapport initial QA.md', type: 'RAPPORT', url: 'storage/sous-traitant/qa_rapport_initial.md' }),
    upsertDocument({ chantierId: chantierAmina.id, nom: 'Photo avant travaux QA.png', type: 'PHOTO', url: 'storage/sous-traitant/qa_photo_avant.png' }),
    upsertDocument({ chantierId: chantierHatem.id, nom: 'Plan cuisine confidentiel.pdf', type: 'PLAN', url: 'https://example.com/plan-cuisine-qa.pdf' }),
  ]);

  await prisma.savTicket.upsert({
    where: { reference: 'SAV-QA-001' },
    update: { companyId: company.id, clientId: amina.id, devisId: devisAmina.id, factureId: factureAmina.id, chantierId: chantierAmina.id, createurId: admin.id, assignedToId: technico.id, titre: 'Joint de douche à reprendre', description: 'Fuite légère après première mise en eau.', statut: SavTicketStatut.OUVERT, priorite: SavTicketPriorite.HAUTE, categorie: SavTicketCategorie.DEFAUT_TRAVAUX },
    create: { companyId: company.id, clientId: amina.id, devisId: devisAmina.id, factureId: factureAmina.id, chantierId: chantierAmina.id, createurId: admin.id, assignedToId: technico.id, reference: 'SAV-QA-001', titre: 'Joint de douche à reprendre', description: 'Fuite légère après première mise en eau.', statut: SavTicketStatut.OUVERT, priorite: SavTicketPriorite.HAUTE, categorie: SavTicketCategorie.DEFAUT_TRAVAUX },
  });

  let demo1 = await prisma.demoRequest.findFirst({ where: { companyId: company.id, email: 'nadia.demo+crm@example.com', source: 'QA_SEED' } });
  demo1 = demo1
    ? await prisma.demoRequest.update({ where: { id: demo1.id }, data: { nom: 'Khelifi', prenom: 'Nadia', telephone: '25123456', entreprise: 'Studio NK', message: 'Demande de démonstration du CRM.', statut: DemoRequestStatut.PENDING, assignedToId: null, dateContact: null, dateDemo: null, notes: 'Donnée QA réinitialisée.' } })
    : await prisma.demoRequest.create({ data: { companyId: company.id, nom: 'Khelifi', prenom: 'Nadia', email: 'nadia.demo+crm@example.com', telephone: '25123456', entreprise: 'Studio NK', message: 'Demande de démonstration du CRM.', statut: DemoRequestStatut.PENDING, source: 'QA_SEED' } });

  let demo2 = await prisma.demoRequest.findFirst({ where: { companyId: company.id, email: 'karim.demo+crm@example.com', source: 'QA_SEED' } });
  demo2 = demo2
    ? await prisma.demoRequest.update({ where: { id: demo2.id }, data: { nom: 'Mansour', prenom: 'Karim', entreprise: 'KM Bâtiment', statut: DemoRequestStatut.SCHEDULED, assignedToId: technico.id, dateContact: now, dateDemo: addDays(now, 1), notes: 'Démonstration QA planifiée.' } })
    : await prisma.demoRequest.create({ data: { companyId: company.id, assignedToId: technico.id, nom: 'Mansour', prenom: 'Karim', email: 'karim.demo+crm@example.com', entreprise: 'KM Bâtiment', statut: DemoRequestStatut.SCHEDULED, source: 'QA_SEED', dateContact: now, dateDemo: addDays(now, 1), notes: 'Démonstration QA planifiée.' } });

  console.log(`✅ Société QA : ${company.nom} (ID ${company.id})`);
  console.log(`✅ Comptes : Admin ${admin.id}, Technico ${technico.id}, Assistante ${assistante.id}, Chef ${chef.id}, Sous-traitant ${sousTraitant.id}`);
  console.log(`✅ Clients : ${amina.id}, ${hatem.id}, ${leila.id}`);
  console.log(`✅ Chantiers : ${chantierAmina.reference}, ${chantierHatem.reference}`);
  console.log(`✅ Réceptions : 3 commandes et 3 événements de réception QA`);
  console.log(`✅ Tâches affectées au Chef et au Sous-traitant`);
  console.log(`✅ Documents, SAV et demandes de démo créés`);
  console.log('\n🎉 Jeu de données QA prêt. Vous pouvez exécuter la checklist manuelle.\n');
}

main()
  .catch((error) => {
    console.error('❌ Erreur pendant la création des données QA :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
