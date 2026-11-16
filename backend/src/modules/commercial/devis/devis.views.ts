import type { Prisma } from '../../../generated/prisma/client';

/**
 * What each audience may see of a quote. Built as explicit WHITELISTS (select), never by
 * deleting fields afterwards: a new column is invisible until someone decides otherwise.
 *
 * v2 security fix: the old public validation link returned the whole quote — costs, profit,
 * margin, purchase prices, and supplier orders with supplier emails.
 */

const LIGNE_INTERNE = {
  id: true,
  ordre: true,
  prestationId: true,
  materiauId: true,
  serviceMainOeuvreId: true,
  description: true,
  quantite: true,
  unite: true,
  dimension: true,
  couleur: true,
  finition: true,
  optionsChoisies: true,
  prixUnitaireVente: true,
  prixAchat: true,
  mainOeuvre: true,
  totalHT: true,
  coutTotal: true,
} satisfies Prisma.LigneDevisSelect;

/** Chef de chantier: what to build, not what it costs or earns. */
const LIGNE_CHANTIER = {
  id: true,
  ordre: true,
  description: true,
  quantite: true,
  unite: true,
  dimension: true,
  couleur: true,
  finition: true,
  optionsChoisies: true,
} satisfies Prisma.LigneDevisSelect;

const LIGNE_CLIENT = {
  ordre: true,
  description: true,
  quantite: true,
  unite: true,
  dimension: true,
  couleur: true,
  finition: true,
  prixUnitaireVente: true,
  totalHT: true,
} satisfies Prisma.LigneDevisSelect;

export const DEVIS_LIST_SELECT = {
  id: true,
  reference: true,
  statut: true,
  versionCourante: true,
  dateCreation: true,
  dateEnvoi: true,
  dateValidation: true,
  totalHT: true,
  totalTTC: true,
  margePourcent: true,
  client: { select: { id: true, nom: true, prenom: true } },
  createur: { select: { id: true, nom: true, prenom: true } },
  chantierId: true,
} satisfies Prisma.DevisSelect;

export const DEVIS_DETAIL_SELECT = {
  id: true,
  reference: true,
  statut: true,
  versionCourante: true,
  dateCreation: true,
  dateEnvoi: true,
  dateValidation: true,
  modeValidation: true,
  motifRefus: true,
  notes: true,
  tauxTVA: true,
  totalHT: true,
  totalTVA: true,
  totalTTC: true,
  coutTotal: true,
  profit: true,
  margePourcent: true,
  signatureClientDate: true,
  signatureConseillerDate: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      typeClient: true,
      nom: true,
      prenom: true,
      siret: true,
      tvaIntracom: true,
      contactNom: true,
      email: true,
      telephone: true,
      adresseClient: true,
      adresseChantier: true,
    },
  },
  createur: { select: { id: true, nom: true, prenom: true } },
  demandeDevis: { select: { id: true, reference: true, description: true } },
  chantier: { select: { id: true, reference: true, statut: true } },
  lignes: { select: LIGNE_INTERNE, orderBy: { ordre: 'asc' } },
  liensClient: {
    select: {
      id: true,
      type: true,
      statut: true,
      destinataire: true,
      versionDevis: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  },
  _count: { select: { versions: true } },
} satisfies Prisma.DevisSelect;

export const DEVIS_CHANTIER_SELECT = {
  id: true,
  reference: true,
  statut: true,
  dateValidation: true,
  notes: true,
  client: { select: { id: true, nom: true, prenom: true, telephone: true, adresseChantier: true } },
  chantier: { select: { id: true, reference: true, statut: true } },
  lignes: { select: LIGNE_CHANTIER, orderBy: { ordre: 'asc' } },
} satisfies Prisma.DevisSelect;

/** The ONLY shape that leaves the company through a client link. */
export const DEVIS_CLIENT_SELECT = {
  reference: true,
  statut: true,
  versionCourante: true,
  dateCreation: true,
  dateEnvoi: true,
  tauxTVA: true,
  totalHT: true,
  totalTVA: true,
  totalTTC: true,
  signatureClientDate: true,
  company: {
    select: { nom: true, adresse: true, email: true, telephone: true, siret: true, logo: true },
  },
  client: {
    select: {
      typeClient: true,
      nom: true,
      prenom: true,
      siret: true,
      tvaIntracom: true,
      contactNom: true,
      adresseClient: true,
      adresseChantier: true,
    },
  },
  createur: { select: { prenom: true, nom: true, email: true, telephone: true } },
  lignes: { select: LIGNE_CLIENT, orderBy: { ordre: 'asc' } },
} satisfies Prisma.DevisSelect;
