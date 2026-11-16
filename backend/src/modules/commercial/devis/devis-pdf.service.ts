import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import type { AuthUser } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import {
  construirePdf,
  pdfDate,
  pdfMontant,
  type PdfDocumentData,
  type PdfSignature,
} from '../../core/pdf/pdf-document';

export const UNITE_LABEL: Record<string, string> = {
  M2: 'm2',
  ML: 'ml',
  M3: 'm3',
  PIECE: 'pièce',
  JOUR: 'jour',
  HEURE: 'heure',
  LITRE: 'litre',
  KG: 'kg',
  FORFAIT: 'forfait',
};

const quantite = (q: { toNumber(): number }) =>
  q.toNumber().toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/\s/g, ' ');

/** QR content printed on the quote (16/11): « BATIFLOW:DEV:<id>:<version>:<code> ». */
export function contenuQrDevis(d: {
  id: number;
  versionCourante: number;
  codeVerification: string;
}) {
  return `BATIFLOW:DEV:${d.id}:${d.versionCourante}:${d.codeVerification}`;
}

/**
 * Quote PDF (16/11, mobile lot B1): emailed with the validation link and downloadable by the
 * office. Only CLIENT-facing data (sale prices): never costs, purchase prices or margin.
 */
@Injectable()
export class DevisPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generer(companyId: number, id: number, db: DbClient = this.prisma): Promise<Buffer> {
    const d = await db.devis.findFirst({
      where: { id, companyId },
      include: {
        company: true,
        client: true,
        createur: { select: { prenom: true, nom: true, email: true, telephone: true } },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            prestation: { select: { nom: true } },
            materiau: { select: { nom: true } },
            serviceMainOeuvre: { select: { nom: true } },
          },
        },
      },
    });
    if (!d) throw new NotFoundException(`Devis #${id} introuvable`);

    const client = d.client;
    const nomClient =
      [client.prenom, client.nom].filter(Boolean).join(' ') || client.contactNom || 'Client';
    const signatures: PdfSignature[] = [];
    if (d.signatureClientDate || d.signatureClientBase64) {
      signatures.push({
        titre: 'Signature du client',
        image: d.signatureClientBase64,
        legende: [
          d.signataireNom,
          d.signatureClientDate ? `le ${pdfDate(d.signatureClientDate)}` : null,
        ]
          .filter(Boolean)
          .join(' '),
      });
    }
    if (d.signatureConseillerBase64) {
      signatures.push({
        titre: 'Pour l’entreprise',
        image: d.signatureConseillerBase64,
        legende: d.signatureConseillerDate ? `le ${pdfDate(d.signatureConseillerDate)}` : null,
      });
    }

    const data: PdfDocumentData = {
      titre: 'Devis',
      reference: d.versionCourante > 1 ? `${d.reference} (v${d.versionCourante})` : d.reference,
      infos: [
        { label: 'Date', valeur: pdfDate(d.dateEnvoi ?? d.dateCreation) },
        { label: 'Validité', valeur: '30 jours' },
        ...(d.createur
          ? [{ label: 'Conseiller', valeur: `${d.createur.prenom} ${d.createur.nom}` }]
          : []),
      ],
      emetteur: {
        nom: d.company.nom,
        lignes: [
          d.company.adresse,
          d.company.telephone,
          d.company.email,
          d.company.siret ? `SIRET ${d.company.siret}` : null,
        ],
      },
      destinataire: {
        nom: nomClient,
        lignes: [
          client.contactNom && client.typeClient !== 'PARTICULIER'
            ? `Contact : ${client.contactNom}`
            : null,
          client.adresseClient,
          client.adresseChantier && client.adresseChantier !== client.adresseClient
            ? `Chantier : ${client.adresseChantier}`
            : null,
          client.siret ? `SIRET ${client.siret}` : null,
          client.tvaIntracom ? `TVA ${client.tvaIntracom}` : null,
        ],
      },
      lignes: d.lignes.map((l) => ({
        description: [
          l.description ||
            l.prestation?.nom ||
            l.materiau?.nom ||
            l.serviceMainOeuvre?.nom ||
            'Prestation',
          l.dimension,
          l.couleur,
          l.finition,
        ]
          .filter(Boolean)
          .join(' - '),
        quantite: quantite(l.quantite),
        unite: UNITE_LABEL[l.unite] ?? l.unite,
        prixUnitaire: pdfMontant(l.prixUnitaireVente),
        total: pdfMontant(l.totalHT),
      })),
      totaux: [
        { label: 'Total HT', valeur: pdfMontant(d.totalHT) },
        {
          label: `TVA ${d.tauxTVA.toNumber().toLocaleString('fr-FR')} %`,
          valeur: pdfMontant(d.totalTVA),
        },
        { label: 'Total TTC', valeur: pdfMontant(d.totalTTC), gras: true },
      ],
      mentions: [
        'Devis gratuit. Bon pour accord : signature précédée de la mention « Bon pour accord ».',
        `Acompte à la signature : ${d.company.acomptePercentDefault.toNumber()} % du montant TTC.`,
      ],
      signatures,
      qr: d.codeVerification
        ? {
            contenu: contenuQrDevis({ ...d, codeVerification: d.codeVerification }),
            legende: `Code de vérification ${d.codeVerification}`,
          }
        : null,
    };
    return construirePdf(data);
  }

  /** Download for the office (GET /devis/:id/pdf). */
  async telecharger(user: AuthUser, id: number): Promise<StreamableFile> {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId: user.companyId },
      select: { reference: true },
    });
    if (!devis) throw new NotFoundException(`Devis #${id} introuvable`);
    const pdf = await this.generer(user.companyId, id);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      length: pdf.length,
      disposition: `inline; filename="${encodeURIComponent(devis.reference)}.pdf"`,
    });
  }

  /** Attachment for the quote emails; null when generation fails (the email still leaves). */
  async pieceJointe(companyId: number, id: number, reference: string) {
    try {
      return [
        {
          filename: `${reference}.pdf`,
          content: await this.generer(companyId, id),
          contentType: 'application/pdf',
        },
      ];
    } catch {
      return undefined;
    }
  }
}
