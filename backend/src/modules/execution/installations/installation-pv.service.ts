import { randomInt } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { construirePdf, pdfDate, type PdfDocumentData } from '../../core/pdf/pdf-document';
import { UNITE_LABEL } from '../../commercial/devis/devis-pdf.service';

/** 6 characters without ambiguous ones (0/O, 1/I): readable if typed by hand. */
export function nouveauCodePv(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}

/** QR content printed on the PV: « BATIFLOW:PV:<installationId>:<code> ». */
export function contenuQrPv(i: { id: number; codePv: string }): string {
  return `BATIFLOW:PV:${i.id}:${i.codePv}`;
}

/** Reads a scanned QR: null when it is not a BATIFLOW PV at all. */
export function lireQrPv(contenu: string): { id: number; code: string } | null {
  const m = /^BATIFLOW:PV:(\d{1,9}):([A-Z0-9]{6,12})$/.exec(contenu.trim());
  return m ? { id: Number(m[1]), code: m[2] } : null;
}

/**
 * PV de fin de travaux (18/11, mobile lot B): printed by the installer, signed by the client,
 * scanned back. Same principle as the quote: a QR code proves which installation it is.
 * No price on it (works list only).
 */
@Injectable()
export class InstallationPvService {
  constructor(private readonly prisma: PrismaService) {}

  async generer(companyId: number, id: number): Promise<Buffer> {
    const i = await this.prisma.installation.findFirst({
      where: { id, companyId },
      include: {
        company: true,
        sousTraitant: { select: { nom: true } },
        chantier: { include: { client: true } },
        devis: {
          select: {
            reference: true,
            lignes: {
              orderBy: { ordre: 'asc' },
              select: {
                description: true,
                quantite: true,
                unite: true,
                prestation: { select: { nom: true } },
              },
            },
          },
        },
      },
    });
    if (!i) throw new NotFoundException(`Installation #${id} introuvable`);
    const client = i.chantier.client;
    const nomClient =
      [client.prenom, client.nom].filter(Boolean).join(' ') || client.contactNom || 'Client';

    const data: PdfDocumentData = {
      titre: 'Procès-verbal de fin de travaux',
      reference: i.reference,
      infos: [
        { label: 'Chantier', valeur: i.chantier.reference },
        ...(i.devis ? [{ label: 'Devis', valeur: i.devis.reference }] : []),
        { label: 'Date de pose', valeur: pdfDate(i.dateConfirmee ?? i.dateSouhaitee) || '—' },
        ...(i.sousTraitant ? [{ label: 'Installateur', valeur: i.sousTraitant.nom }] : []),
      ],
      emetteur: {
        nom: i.company.nom,
        lignes: [i.company.adresse, i.company.telephone, i.company.email],
      },
      destinataire: {
        nom: nomClient,
        lignes: [client.telephone, `Chantier : ${i.chantier.adresse}`],
      },
      lignes: (i.devis?.lignes ?? []).map((l) => ({
        description: l.description || l.prestation?.nom || 'Prestation',
        quantite: l.quantite.toNumber().toLocaleString('fr-FR', { maximumFractionDigits: 3 }),
        unite: UNITE_LABEL[l.unite] ?? l.unite,
        prixUnitaire: '',
        total: '',
      })),
      totaux: [],
      mentions: [
        'Le client déclare que les travaux ci-dessus sont terminés et les réceptionne :',
        '[ ] sans réserve      [ ] avec les réserves suivantes : ......................................',
        '...................................................................................................',
        'Fait à ........................................, le ......../......../............',
      ],
      signatures: [
        { titre: 'Le client (bon pour réception)', legende: nomClient },
        { titre: 'L’installateur', legende: i.sousTraitant?.nom ?? null },
      ],
      qr: { contenu: contenuQrPv(i), legende: `Code ${i.codePv}` },
    };
    return construirePdf(data);
  }
}
