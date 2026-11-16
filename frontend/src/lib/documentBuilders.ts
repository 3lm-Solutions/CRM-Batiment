import type { CommandeFournisseur, Devis, FournisseurCommandeDetail } from '@/types';

export interface SupplierPurchaseDocumentData {
  reference: string;
  date: string;
  statutLivraison: string;
  dateLivraisonPrevue?: string;
  notes?: string;
  devisReference: string;
  clientName: string;
  chantierReference?: string;
  chantierAddress: string;
  fournisseur?: {
    id?: number;
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    contact?: string;
  };
  lignes?: {
    id: number;
    materiauNom: string;
    quantite: number;
    unite: string;
    prixUnitaire: number;
    totalHT: number;
  }[];
  totalHT: number;
}

export function getClientDisplayName(devis: Devis) {
  if (!devis.client) return 'Client non renseigne';
  return `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim() || devis.client.nom;
}

export function getChantierAddress(devis: Devis) {
  return devis.client?.adresseChantier || devis.client?.adresseClient || 'Adresse non renseignee';
}

export function buildSupplierPurchaseDocumentData(
  devis: Devis,
  commande: CommandeFournisseur,
): SupplierPurchaseDocumentData {
  const totalHT = (commande.lignes ?? []).reduce((sum, line) => sum + (line.totalHT ?? 0), 0);

  return {
    reference: commande.reference,
    date: commande.date,
    statutLivraison: commande.statutLivraison,
    dateLivraisonPrevue: commande.dateLivraisonPrevue,
    notes: commande.notes,
    devisReference: devis.reference,
    clientName: getClientDisplayName(devis),
    chantierReference: devis.chantierId ? `CHANTIER-${devis.chantierId}` : undefined,
    chantierAddress: getChantierAddress(devis),
    fournisseur: commande.fournisseur
      ? {
          id: commande.fournisseur.id,
          nom: commande.fournisseur.nom,
          email: commande.fournisseur.email,
        }
      : undefined,
    lignes: commande.lignes,
    totalHT,
  };
}

export function buildSupplierPurchaseDocumentDataFromOrderDetail(
  commande: FournisseurCommandeDetail,
): SupplierPurchaseDocumentData {
  return {
    reference: commande.reference,
    date: commande.date,
    statutLivraison: commande.statutLivraison,
    dateLivraisonPrevue: commande.dateLivraisonPrevue,
    notes: commande.notes,
    devisReference: commande.devis.reference,
    clientName:
      `${commande.devis.client?.prenom ?? ''} ${commande.devis.client?.nom ?? ''}`.trim() ||
      commande.devis.client?.nom ||
      'Client non renseigne',
    chantierReference: commande.devis.chantier?.reference,
    chantierAddress: commande.devis.chantier?.adresse ?? 'Adresse non renseignee',
    fournisseur: commande.fournisseur
      ? {
          id: commande.fournisseur.id,
          nom: commande.fournisseur.nom,
          email: commande.fournisseur.email,
          telephone: commande.fournisseur.telephone,
          adresse: commande.fournisseur.adresse,
          contact: commande.fournisseur.contact,
        }
      : undefined,
    lignes: commande.lignes,
    totalHT: commande.metrics.totalMontantHT,
  };
}
