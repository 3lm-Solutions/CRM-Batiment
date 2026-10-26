/**
 * Core seed data: company, the 6 demo accounts (one per role), portal profiles, project types.
 */
import { hash } from 'bcryptjs';
import { PrismaClient, Role } from '../../generated/prisma/client';

const BCRYPT_ROUNDS = 12;

interface SeedUser {
  role: Role;
  email: string;
  password: string;
  prenom: string;
  nom: string;
  telephone?: string;
}

// Same demo accounts as the old project, plus the new FOURNISSEUR role.
export const USERS: SeedUser[] = [
  { role: Role.ADMIN, email: 'admin@batiment-pro.fr', password: 'Admin@2026!', prenom: 'Super', nom: 'Admin' },
  { role: Role.TECHNICO, email: 'technico@batiment-pro.fr', password: 'Technico@2026!', prenom: 'Marc', nom: 'Dupont', telephone: '0678901234' },
  { role: Role.ASSISTANTE, email: 'assistante@batiment-pro.fr', password: 'Assistante@2026!', prenom: 'Sophie', nom: 'Martin', telephone: '0612345678' },
  { role: Role.CHEF_CHANTIER, email: 'chef@batiment-pro.fr', password: 'Chef@2026!', prenom: 'Jean', nom: 'Leroy', telephone: '0622334455' },
  { role: Role.SOUS_TRAITANT, email: 'soustraitant@batiment-pro.fr', password: 'Soustraitant@2026!', prenom: 'Pierre', nom: 'Bernard', telephone: '0655667788' },
  { role: Role.FOURNISSEUR, email: 'fournisseur@batiment-pro.fr', password: 'Fournisseur@2026!', prenom: 'Claire', nom: 'Durand', telephone: '0144556677' },
];

export const TYPES_PROJET: { nom: string; description: string }[] = [
  { nom: 'Rénovation salle de bain', description: 'Travaux de rénovation complète ou partielle de salle de bain' },
  { nom: 'Rénovation cuisine', description: 'Travaux de rénovation de cuisine' },
  { nom: 'Rénovation appartement', description: "Rénovation complète d'un appartement" },
  { nom: 'Rénovation maison', description: "Rénovation complète d'une maison" },
  { nom: 'Construction neuve', description: "Construction d'un bâtiment neuf" },
  { nom: 'Extension / Surélévation', description: 'Extension ou surélévation de bâtiment existant' },
  { nom: 'Carrelage / Faïence', description: 'Pose de carrelage sol et mur' },
  { nom: 'Peinture / Décoration', description: 'Travaux de peinture intérieure et extérieure' },
  { nom: 'Plomberie / Sanitaire', description: 'Installation et réparation plomberie' },
  { nom: 'Électricité', description: 'Installation et mise aux normes électriques' },
  { nom: 'Maçonnerie / Gros œuvre', description: 'Travaux de maçonnerie et structure' },
  { nom: 'Isolation / Plâtrerie', description: 'Isolation thermique et phonique, placo' },
  { nom: 'Menuiserie', description: 'Pose de portes, fenêtres, placards' },
  { nom: 'Revêtement de sol', description: 'Pose de parquet, vinyle, moquette' },
  { nom: 'Toiture / Couverture', description: 'Travaux de toiture et charpente' },
  { nom: 'Aménagement extérieur', description: 'Terrasse, clôture, aménagement jardin' },
  { nom: 'Démolition / Désamiantage', description: 'Travaux de démolition et dépose' },
];

export async function seedCompany(prisma: PrismaClient) {
  return prisma.company.upsert({
    where: { siret: '12345678901234' },
    update: {},
    create: {
      nom: 'Bâtiment Pro SARL',
      siret: '12345678901234',
      adresse: '123 Rue de la Construction, 75001 Paris',
      telephone: '0145678900',
      email: 'contact@batiment-pro.fr',
      tvaDefaut: 20,
      devise: 'EUR',
    },
  });
}

export async function seedUsers(prisma: PrismaClient, companyId: number) {
  const byRole = new Map<Role, number>();

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        companyId,
        email: u.email,
        password: await hash(u.password, BCRYPT_ROUNDS),
        role: u.role,
        prenom: u.prenom,
        nom: u.nom,
        telephone: u.telephone,
        mustChangePassword: false, // demo accounts: no forced change
      },
    });
    byRole.set(u.role, user.id);
  }

  return byRole;
}

/** Supplier of the demo FOURNISSEUR account (exists in data/fournisseurs.json, supplies paint materials). */
export const DEMO_SUPPLIER = 'Parexlanko';

/** Links the portal accounts to their business records (SousTraitant / Fournisseur). */
export async function seedPortalProfiles(prisma: PrismaClient, companyId: number, users: Map<Role, number>) {
  const sousTraitantUserId = users.get(Role.SOUS_TRAITANT)!;
  await prisma.sousTraitant.upsert({
    where: { userId: sousTraitantUserId },
    update: {},
    create: {
      companyId,
      userId: sousTraitantUserId,
      nom: 'Bernard Carrelage SARL',
      contact: 'Pierre Bernard',
      siret: '98765432100011',
      email: 'soustraitant@batiment-pro.fr',
      telephone: '0655667788',
      specialite: 'Carrelage / Faïence',
    },
  });

  // The demo supplier account is linked to a supplier that really supplies catalogue
  // materials, so accepted quotes create orders it can see in its portal (20/10: the old
  // « Matériaux Durand » supplied nothing, and the portal stayed empty).
  const fournisseurUserId = users.get(Role.FOURNISSEUR)!;
  await prisma.fournisseur.updateMany({
    where: { userId: fournisseurUserId, NOT: { companyId, nom: DEMO_SUPPLIER } },
    data: { userId: null },
  });
  const existing = await prisma.fournisseur.findFirst({ where: { companyId, nom: DEMO_SUPPLIER } });
  if (existing) {
    if (existing.userId !== fournisseurUserId) {
      await prisma.fournisseur.update({ where: { id: existing.id }, data: { userId: fournisseurUserId } });
    }
  } else {
    // Same values as data/fournisseurs.json: the catalogue seed then finds it by name
    await prisma.fournisseur.create({
      data: {
        companyId,
        userId: fournisseurUserId,
        nom: DEMO_SUPPLIER,
        contact: 'Alain Giraud',
        email: 'commercial@parexlanko.fr',
        telephone: '04 78 90 11 22',
        delaiLivraison: 4,
      },
    });
  }
}

export async function seedTypesProjet(prisma: PrismaClient, companyId: number) {
  for (const tp of TYPES_PROJET) {
    await prisma.typeProjet.upsert({
      where: { companyId_nom: { companyId, nom: tp.nom } },
      update: {},
      create: { companyId, ...tp },
    });
  }
}

