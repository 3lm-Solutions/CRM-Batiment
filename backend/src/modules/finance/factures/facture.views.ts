import { randomBytes } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client';
import type { DbClient } from '../../../prisma/prisma.types';

/** 192 random bits, URL-safe: the « view online » link printed as a QR code on the invoice (21/10). */
export const newPublicToken = () => randomBytes(24).toString('base64url');

/**
 * Invoices issued before 21/10, or before the bank details were set: the QR code link and, while
 * unpaid, the bank details are added when the invoice is opened — nothing else ever changes.
 * Returns true when the row was updated (re-read it).
 */
export async function completerQrFacture(
  db: DbClient,
  f: { id: number; companyId: number; reference: string | null; statut: string; lienPublicToken: string | null; companyIban: string | null },
): Promise<boolean> {
  if (!f.reference || f.statut === 'BROUILLON') return false;
  const sansLien = !f.lienPublicToken;
  const sansBanque = f.statut === 'ENVOYEE' && !f.companyIban;
  if (!sansLien && !sansBanque) return false;
  const company = sansBanque ? await db.company.findUniqueOrThrow({ where: { id: f.companyId }, select: { iban: true, bic: true } }) : null;
  const data = {
    ...(sansLien ? { lienPublicToken: newPublicToken() } : {}),
    ...(company?.iban ? { companyIban: company.iban, companyBic: company.bic } : {}),
  };
  if (!Object.keys(data).length) return false;
  await db.facture.update({ where: { id: f.id }, data });
  return true;
}

/**
 * What a client may see of an issued invoice (client space, public link / QR code of 21/10):
 * the legal document only — never costs, margins or internal notes.
 */
export const FACTURE_CLIENT_SELECT = {
  id: true,
  reference: true,
  typeFacture: true,
  statut: true,
  numeroSituation: true,
  avancementCumule: true,
  date: true,
  dateEmission: true,
  dateEcheance: true,
  datePaiement: true,
  tauxTVA: true,
  montantHT: true,
  montantTVA: true,
  montantTTC: true,
  acomptePercent: true,
  referenceDevis: true,
  nomClient: true,
  prenomClient: true,
  emailClient: true,
  adresseClient: true,
  companyNom: true,
  companyEmail: true,
  companyTelephone: true,
  companyAdresse: true,
  companySiret: true,
  conditionsPaiement: true,
  communicationPaiement: true,
  notesLegales: true,
  // Payment QR code and « view online » QR code (21/10)
  companyIban: true,
  companyBic: true,
  lienPublicToken: true,
  factureOrigine: { select: { reference: true } },
  lignes: { orderBy: { ordre: 'asc' }, select: { id: true, description: true, quantite: true, unite: true, prixUnitaireHT: true, montantHT: true } },
} satisfies Prisma.FactureSelect;
