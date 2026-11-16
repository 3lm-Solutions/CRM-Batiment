import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { WorkflowStateService } from '../common/workflow-state.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateDevisDto } from './dto/update-devis.dto.js';
import { QueryDevisDto } from './dto/query-devis.dto.js';
import { UpdateDevisStatutDto } from './dto/update-devis-statut.dto.js';
import { CreateLigneDevisDto } from './dto/create-ligne-devis.dto.js';
import { UpdateLigneDevisDto } from './dto/update-ligne-devis.dto.js';
import { SendClientSignatureDto } from './dto/send-client-signature.dto.js';
import { VerifySignatureOtpDto } from './dto/verify-signature-otp.dto.js';
import { SubmitClientSignatureDto } from './dto/submit-client-signature.dto.js';
import {
  ClientValidationDecision,
  RespondClientValidationDto,
} from './dto/respond-client-validation.dto.js';
import type {
  DevisClientSignatureStatut,
  DevisStatut,
  Unite,
} from '../../generated/prisma/client.js';

// Transitions defined centrally in WorkflowStateService

const MAX_SIGNATURE_OTP_ATTEMPTS = 3;

interface ValidationTokenPayload {
  type: 'devis_validation';
  devisId: number;
  clientId: number;
  companyId: number;
}

interface SignatureSessionTokenPayload {
  type: 'devis_signature_session';
  requestId: number;
  devisId: number;
  companyId: number;
}

interface SupplierRequirementLine {
  materiauId: number;
  materiauNom: string;
  unite: Unite;
  quantite: number;
  prixUnitaire: number;
  totalHT: number;
}

interface SupplierRequirementGroup {
  fournisseurId: number;
  fournisseurNom: string;
  fournisseurEmail?: string | null;
  delaiLivraison?: number | null;
  lines: SupplierRequirementLine[];
}

export interface AcceptedArtifactsSummary {
  factureReference?: string;
  bonCommandeReference?: string;
  commandesFournisseurReferences: string[];
  warnings: string[];
}

interface MaterialSupplierInfo {
  id: number;
  nom: string;
  email?: string | null;
  delaiLivraison?: number | null;
}

interface CachedMaterialComposition {
  quantiteParUnite: number;
  materiau: {
    id: number;
    nom: string;
    unite: Unite;
    prixAchatFixe: number;
    fournisseur: MaterialSupplierInfo | null;
  } | null;
  serviceMainOeuvre: { id: number } | null;
}

interface CachedPrestationForOrders {
  compositions: CachedMaterialComposition[];
  options: {
    nom: string;
    choix: {
      nom: string;
      compositions: CachedMaterialComposition[];
    }[];
  }[];
}

@Injectable()
export class DevisService {
  private readonly logger = new Logger(DevisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly workflowStateService: WorkflowStateService,
  ) {}

  private normalizePhone(phone: string) {
    return phone.replace(/[^\d+]/g, '');
  }

  private maskPhone(phone: string) {
    const normalized = this.normalizePhone(phone);
    if (normalized.length <= 4) return normalized;
    return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
  }

  private hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private isMatchingHash(rawValue: string, hashedValue: string) {
    const rawBuffer = Buffer.from(this.hashValue(rawValue), 'utf8');
    const hashBuffer = Buffer.from(hashedValue, 'utf8');
    return (
      rawBuffer.length === hashBuffer.length &&
      timingSafeEqual(rawBuffer, hashBuffer)
    );
  }

  private ensureSignatureDataUrl(signatureBase64: string) {
    if (!signatureBase64.startsWith('data:image/png;base64,')) {
      throw new BadRequestException(
        'La signature doit etre une image PNG base64 valide.',
      );
    }
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private calcCompositionsCostPerUnit(
    compositions: {
      quantiteParUnite: number;
      materiau: { prixAchatFixe: number } | null;
      serviceMainOeuvre: { prixUnitaire: number } | null;
    }[],
  ) {
    return compositions.reduce((sum, composition) => {
      const materialCost = composition.materiau
        ? composition.quantiteParUnite * composition.materiau.prixAchatFixe
        : 0;
      const laborCost = composition.serviceMainOeuvre
        ? composition.quantiteParUnite *
          composition.serviceMainOeuvre.prixUnitaire
        : 0;

      return sum + materialCost + laborCost;
    }, 0);
  }

  private getFrontendBaseUrl() {
    return (
      this.configService.get<string>('APP_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  private createValidationToken(payload: ValidationTokenPayload) {
    return this.jwtService.sign(payload, { expiresIn: '30d' });
  }

  private createSignatureSessionToken(payload: SignatureSessionTokenPayload) {
    return this.jwtService.sign(payload, { expiresIn: '30m' });
  }

  private verifyValidationToken(token: string): ValidationTokenPayload {
    try {
      const payload = this.jwtService.verify<ValidationTokenPayload>(token);
      if (
        payload?.type !== 'devis_validation' ||
        !payload.devisId ||
        !payload.clientId ||
        !payload.companyId
      ) {
        throw new BadRequestException('Lien de validation invalide.');
      }
      return payload;
    } catch {
      throw new BadRequestException('Lien de validation invalide ou expire.');
    }
  }

  private verifySignatureSessionToken(
    token: string,
  ): SignatureSessionTokenPayload {
    try {
      const payload =
        this.jwtService.verify<SignatureSessionTokenPayload>(token);
      if (
        payload?.type !== 'devis_signature_session' ||
        !payload.requestId ||
        !payload.devisId ||
        !payload.companyId
      ) {
        throw new BadRequestException('Session de signature invalide.');
      }
      return payload;
    } catch {
      throw new BadRequestException(
        'Session de signature invalide ou expiree.',
      );
    }
  }

  private async sendSms(to: string, message: string) {
    // Placeholder provider: en production, brancher ici Twilio / OVH SMS.
    this.logger.log(`[SMS][MOCK] to=${to} message="${message}"`);
  }

  private async generateReference(companyId: number): Promise<string> {
    const year = new Date().getFullYear();

    const prefix = `DEV-${year}-`;
    const lastDevis = await this.prisma.devis.findFirst({
      where: {
        companyId,
        reference: { startsWith: prefix },
      },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });

    const lastSegment = lastDevis?.reference?.split('-').at(-1) ?? '';
    const parsed = Number.parseInt(lastSegment, 10);
    const nextNumber = Number.isFinite(parsed) ? parsed + 1 : 1;

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  private async generateChantierReferenceFromDevisReference(
    devisReference: string,
  ) {
    const baseReference = `CH-${devisReference}`.replace(/\s+/g, '-');
    let reference = baseReference;
    let suffix = 1;

    while (
      await this.prisma.chantier.findUnique({
        where: { reference },
        select: { id: true },
      })
    ) {
      suffix += 1;
      reference = `${baseReference}-${suffix}`;
    }

    return reference;
  }

  private buildAutoChantierDescriptionFromDevis(input: {
    devisReference: string;
    clientNom: string;
    clientPrenom?: string | null;
    notes?: string | null;
    lignes: Array<{
      quantite: number;
      unite: Unite;
      description?: string | null;
      prestation?: { nom: string } | null;
      materiau?: { nom: string } | null;
      serviceMainOeuvre?: { nom: string } | null;
    }>;
  }) {
    const travaux = input.lignes.slice(0, 12).map((ligne) => {
      const label =
        ligne.description?.trim() ||
        ligne.prestation?.nom ||
        ligne.materiau?.nom ||
        ligne.serviceMainOeuvre?.nom ||
        'Ligne travaux';

      return `${label} (${ligne.quantite} ${ligne.unite})`;
    });

    const fullName = `${input.clientPrenom ?? ''} ${input.clientNom}`.trim();

    return [
      `Genere automatiquement depuis le devis ${input.devisReference}.`,
      `Client: ${fullName || input.clientNom}.`,
      travaux.length > 0
        ? `Detail travaux: ${travaux.join(', ')}.`
        : 'Detail travaux: a preciser.',
      input.notes?.trim() ? `Notes devis: ${input.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private async ensureChantierLinkedToDevis(
    devisId: number,
    companyId: number,
  ) {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            adresseChantier: true,
            adresseClient: true,
          },
        },
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

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} introuvable`);
    }

    if (devis.chantierId) {
      return devis.chantierId;
    }

    const reference = await this.generateChantierReferenceFromDevisReference(
      devis.reference,
    );
    const adresse =
      devis.client.adresseChantier?.trim() ||
      devis.client.adresseClient?.trim() ||
      'Adresse chantier a confirmer';

    const chantier = await this.prisma.chantier.create({
      data: {
        companyId: devis.companyId,
        clientId: devis.clientId,
        reference,
        adresse,
        description: this.buildAutoChantierDescriptionFromDevis({
          devisReference: devis.reference,
          clientNom: devis.client.nom,
          clientPrenom: devis.client.prenom,
          notes: devis.notes,
          lignes: devis.lignes,
        }),
        statut: 'PLANIFIE', //ici j'ai changé le statut à planifié suite au cahier de charge

      },
      select: { id: true },
    });

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: { chantierId: chantier.id },
    });

    return chantier.id;
  }

  private async generateDocumentReference(
    prefix: 'FAC' | 'BC' | 'BAF',
    model: 'facture' | 'bonCommande' | 'commandeFournisseur',
  ) {
    const year = new Date().getFullYear();
    const start = `${prefix}-${year}`;

    const count =
      model === 'facture'
        ? await this.prisma.facture.count({
            where: { reference: { startsWith: start } },
          })
        : model === 'bonCommande'
          ? await this.prisma.bonCommande.count({
              where: { reference: { startsWith: start } },
            })
          : await this.prisma.commandeFournisseur.count({
              where: { reference: { startsWith: start } },
            });

    return `${start}-${String(count + 1).padStart(4, '0')}`;
  }

  private isReferenceUniqueConstraintError(error: unknown) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    // In production with the current DB adapter, target metadata can be missing.
    // For Devis creation, P2002 here corresponds to the unique reference conflict.
    const code = (error as { code?: unknown }).code;
    return code === 'P2002';
  }

  private parseSelectedChoicesFromLineDescription(description?: string) {
    if (!description) return [];

    const start = description.indexOf('(');
    const end = description.lastIndexOf(')');
    if (start === -1 || end === -1 || end <= start) return [];

    return description
      .slice(start + 1, end)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.includes(':'))
      .map((part) => {
        const [optionName, choiceName] = part.split(':');
        return {
          optionName: optionName?.trim() ?? '',
          choiceName: choiceName?.trim() ?? '',
        };
      })
      .filter((entry) => entry.optionName && entry.choiceName);
  }

  private async buildSupplierRequirementsForAcceptedDevis(
    devisId: number,
    companyId: number,
  ): Promise<{ groups: SupplierRequirementGroup[]; warnings: string[] }> {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: {
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            materiau: {
              include: {
                fournisseur: true,
              },
            },
          },
        },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} introuvable`);
    }

    const groups = new Map<number, SupplierRequirementGroup>();
    const warnings: string[] = [];
    const prestationCache = new Map<number, CachedPrestationForOrders | null>();

    const addRequirement = (
      fournisseur: {
        id: number;
        nom: string;
        email?: string | null;
        delaiLivraison?: number | null;
      },
      line: SupplierRequirementLine,
    ) => {
      const existingGroup = groups.get(fournisseur.id);
      const currentGroup: SupplierRequirementGroup = existingGroup ?? {
        fournisseurId: fournisseur.id,
        fournisseurNom: fournisseur.nom,
        fournisseurEmail: fournisseur.email,
        delaiLivraison: fournisseur.delaiLivraison,
        lines: [],
      };

      const existingLine = currentGroup.lines.find(
        (currentLine) => currentLine.materiauId === line.materiauId,
      );

      if (existingLine) {
        existingLine.quantite = this.round2(
          existingLine.quantite + line.quantite,
        );
        existingLine.totalHT = this.round2(existingLine.totalHT + line.totalHT);
      } else {
        currentGroup.lines.push(line);
      }

      groups.set(fournisseur.id, currentGroup);
    };

    for (const ligne of devis.lignes) {
      if (ligne.materiau?.fournisseur && !ligne.prestationId) {
        addRequirement(ligne.materiau.fournisseur, {
          materiauId: ligne.materiau.id,
          materiauNom: ligne.materiau.nom,
          unite: ligne.materiau.unite,
          quantite: this.round2(ligne.quantite),
          prixUnitaire: this.round2(ligne.materiau.prixAchatFixe),
          totalHT: this.round2(ligne.quantite * ligne.materiau.prixAchatFixe),
        });
      }

      if (!ligne.prestationId) continue;

      if (!prestationCache.has(ligne.prestationId)) {
        const prestation = await this.prisma.prestation.findFirst({
          where: { id: ligne.prestationId, companyId },
          include: {
            compositions: {
              include: {
                materiau: {
                  include: { fournisseur: true },
                },
                serviceMainOeuvre: true,
              },
            },
            options: {
              include: {
                choix: {
                  include: {
                    compositions: {
                      include: {
                        materiau: {
                          include: { fournisseur: true },
                        },
                        serviceMainOeuvre: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        prestationCache.set(ligne.prestationId, prestation);
      }

      const prestation = prestationCache.get(ligne.prestationId);
      if (!prestation) continue;

      const selectedChoices = this.parseSelectedChoicesFromLineDescription(
        ligne.description,
      );
      const selectedChoiceCompositions = selectedChoices.flatMap(
        (selectedChoice) => {
          const option = prestation.options.find(
            (currentOption) => currentOption.nom === selectedChoice.optionName,
          );
          const choix = option?.choix.find(
            (currentChoice) => currentChoice.nom === selectedChoice.choiceName,
          );
          return choix?.compositions ?? [];
        },
      );

      const activeCompositions =
        selectedChoiceCompositions.length > 0
          ? selectedChoiceCompositions
          : prestation.compositions;

      for (const composition of activeCompositions) {
        if (!composition.materiau) continue;

        if (!composition.materiau.fournisseur) {
          warnings.push(
            `Materiau ${composition.materiau.nom} sans fournisseur pour la ligne ${ligne.description ?? ligne.id}.`,
          );
          continue;
        }

        const quantite = this.round2(
          composition.quantiteParUnite * ligne.quantite,
        );
        addRequirement(composition.materiau.fournisseur, {
          materiauId: composition.materiau.id,
          materiauNom: composition.materiau.nom,
          unite: composition.materiau.unite,
          quantite,
          prixUnitaire: this.round2(composition.materiau.prixAchatFixe),
          totalHT: this.round2(quantite * composition.materiau.prixAchatFixe),
        });
      }
    }

    return {
      groups: Array.from(groups.values()).filter(
        (group) => group.lines.length > 0,
      ),
      warnings,
    };
  }

  private buildSupplierDeliveryDate(delaiLivraison?: number | null) {
    if (!delaiLivraison || delaiLivraison <= 0) {
      return null;
    }

    return new Date(Date.now() + delaiLivraison * 24 * 60 * 60 * 1000);
  }

  private async ensureAcceptedDocumentsGenerated(
    devisId: number,
    companyId: number,
  ): Promise<AcceptedArtifactsSummary> {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: {
        company: { select: { nom: true } },
        client: { select: { id: true, nom: true, prenom: true } },
        createur: { select: { nom: true, prenom: true } },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} introuvable`);
    }

    const chantierId = await this.ensureChantierLinkedToDevis(
      devis.id,
      companyId,
    );
    // ── AVANT MODIFICATION ──────────────────────────────────────────
    // let facture = await this.prisma.facture.findFirst({ where: { devisId } });
    let facture = await this.prisma.facture.findFirst({ where: { devisId } });
    if (!facture) {
      // Acompte selon configuration (30% ou 40%)
      let acomptePercent = Number(this.configService.get<string | number>('ACOMPTE_PERCENT') ?? 30);
      if (acomptePercent !== 30 && acomptePercent !== 40) {
        acomptePercent = 30;
      }
      const acompteMontantHT = this.round2(devis.totalHT * acomptePercent / 100);
      const acompteMontantTVA = this.round2(acompteMontantHT * (devis.tauxTVA / 100));
      const acompteMontantTTC = this.round2(acompteMontantHT + acompteMontantTVA);

      facture = await this.prisma.facture.create({
        data: {
          devisId,
          reference: await this.generateDocumentReference('FAC', 'facture'),
          montantHT: acompteMontantHT,
          montantTVA: acompteMontantTVA,
          montantTTC: acompteMontantTTC,
          statut: 'BROUILLON',
          typeFacture: 'ACOMPTE',
          acomptePercent,
          acompteMontant: acompteMontantTTC,
        },
      });
    }

    let bonCommande = await this.prisma.bonCommande.findUnique({
      where: { devisId },
    });
    if (!bonCommande) {
      bonCommande = await this.prisma.bonCommande.create({
        data: {
          devisId,
          reference: await this.generateDocumentReference('BC', 'bonCommande'),
          statut: 'BROUILLON',
        },
      });
    }

    const requirements = await this.buildSupplierRequirementsForAcceptedDevis(
      devisId,
      companyId,
    );
    const existingOrders = await this.prisma.commandeFournisseur.findMany({
      where: { devisId },
      include: {
        fournisseur: true,
        lignes: true,
      },
    });

    for (const group of requirements.groups) {
      const alreadyExists = existingOrders.find(
        (order) => order.fournisseurId === group.fournisseurId,
      );
      if (alreadyExists) continue;

      const dateLivraisonPrevue = this.buildSupplierDeliveryDate(
        group.delaiLivraison,
      );

      await this.prisma.commandeFournisseur.create({
        data: {
          devisId,
          fournisseurId: group.fournisseurId,
          reference: await this.generateDocumentReference(
            'BAF',
            'commandeFournisseur',
          ),
          statutLivraison: 'CREEE',
          dateLivraisonPrevue: dateLivraisonPrevue ?? undefined,
          notes: `Commande generee automatiquement depuis le devis ${devis.reference}.`,
          lignes: {
            create: group.lines.map((line) => ({
              materiauNom: line.materiauNom,
              quantite: line.quantite,
              unite: line.unite,
              prixUnitaire: line.prixUnitaire,
              totalHT: line.totalHT,
            })),
          },
        },
      });
    }

    const commandesFournisseur = await this.prisma.commandeFournisseur.findMany(
      {
        where: { devisId },
        orderBy: { createdAt: 'asc' },
      },
    );

    await this.prisma.chantier.update({
      where: { id: chantierId },
      data: {
        statut:
          commandesFournisseur.length > 0
            ? 'COMMANDES_GENEREES'
            : 'DEVIS_VALIDE',
      },
    });

    return {
      factureReference: facture.reference,
      bonCommandeReference: bonCommande.reference,
      commandesFournisseurReferences: commandesFournisseur.map(
        (order) => order.reference,
      ),
      warnings: requirements.warnings,
    };
  }

  async validateBonCommandeAndSend(id: number, companyId: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId },
      include: {
        company: { select: { nom: true } },
        bonCommande: true,
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${id} introuvable`);
    }

    if (!['ACCEPTE', 'SIGNE'].includes(devis.statut)) {
      throw new ForbiddenException(
        'Le bon de commande ne peut etre valide qu apres acceptation du devis.',
      );
    }

    const generated = await this.ensureAcceptedDocumentsGenerated(id, companyId);

    const bonCommande = await this.prisma.bonCommande.findUnique({
      where: { devisId: id },
    });

    if (!bonCommande) {
      throw new NotFoundException(
        `Bon de commande introuvable pour le devis #${id}.`,
      );
    }

    const orders = await this.prisma.commandeFournisseur.findMany({
      where: { devisId: id },
      include: {
        fournisseur: true,
        lignes: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const warnings = [...generated.warnings];
    const commandesEnvoyeesReferences: string[] = [];

    for (const order of orders) {
      if (order.statutLivraison !== 'CREEE' || order.dateEnvoi) {
        continue;
      }

      if (!order.fournisseur.email) {
        warnings.push(
          `La commande fournisseur ${order.reference} n a pas ete envoyee: aucun email configure pour ${order.fournisseur.nom}.`,
        );
        continue;
      }

      try {
        await this.mailService.sendSupplierOrderEmail({
          to: order.fournisseur.email,
          supplierName: order.fournisseur.nom,
          reference: order.reference,
          companyName: devis.company?.nom ?? 'CRM Batiment',
          devisReference: devis.reference,
          lines: order.lignes.map((line) => ({
            materiauNom: line.materiauNom,
            quantite: line.quantite,
            unite: line.unite,
            prixUnitaire: line.prixUnitaire,
            totalHT: line.totalHT,
          })),
        });

        await this.prisma.commandeFournisseur.update({
          where: { id: order.id },
          data: {
            statutLivraison: 'ENVOYEE',
            dateEnvoi: new Date(),
            dateLivraisonPrevue:
              order.dateLivraisonPrevue ??
              this.buildSupplierDeliveryDate(order.fournisseur.delaiLivraison) ??
              undefined,
          },
        });

        commandesEnvoyeesReferences.push(order.reference);
      } catch {
        warnings.push(
          `La commande fournisseur ${order.reference} n a pas pu etre envoyee a ${order.fournisseur.nom}.`,
        );
      }
    }

    const hasAlreadyBeenSent = orders.some(
      (order) => order.dateEnvoi || order.statutLivraison !== 'CREEE',
    );
    const nextBonCommandeStatus =
      commandesEnvoyeesReferences.length > 0 || hasAlreadyBeenSent
        ? 'ENVOYE'
        : 'VALIDE';

    const updatedBonCommande =
      bonCommande.statut === nextBonCommandeStatus
        ? bonCommande
        : await this.prisma.bonCommande.update({
            where: { id: bonCommande.id },
            data: { statut: nextBonCommandeStatus },
          });

    const message =
      commandesEnvoyeesReferences.length > 0
        ? `Bon de commande ${updatedBonCommande.reference} valide et ${commandesEnvoyeesReferences.length} commande(s) fournisseur envoyee(s).`
        : orders.length === 0
          ? `Bon de commande ${updatedBonCommande.reference} valide. Aucune commande fournisseur a envoyer.`
          : `Bon de commande ${updatedBonCommande.reference} valide. Aucune nouvelle commande fournisseur n a ete envoyee.`;

    return {
      message,
      devis: await this.findOne(id, companyId),
      bonCommandeReference: updatedBonCommande.reference,
      commandesEnvoyeesReferences,
      warnings,
    };
  }

  private async getDevisForClientValidation(
    devisId: number,
    companyId: number,
    clientId?: number,
  ) {
    const devis = await this.prisma.devis.findFirst({
      where: {
        id: devisId,
        companyId,
        ...(clientId ? { clientId } : {}),
      },
      include: {
        company: {
          select: { id: true, nom: true, adresse: true, email: true, telephone: true, siret: true },
        },
        client: true,
        createur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        factures: { orderBy: { createdAt: 'desc' } },
        bonCommande: true,
        commandesFournisseur: {
          orderBy: { createdAt: 'asc' },
          include: {
            fournisseur: { select: { id: true, nom: true, email: true } },
            lignes: true,
          },
        },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            prestation: { select: { id: true, nom: true } },
            materiau: { select: { id: true, nom: true } },
            serviceMainOeuvre: { select: { id: true, nom: true } },
          },
        },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} introuvable`);
    }

    return devis;
  }

  private async getSignatureRequestByToken(token: string) {
    if (!token) {
      throw new BadRequestException('Le token de signature est obligatoire.');
    }

    const request = await this.prisma.devisClientSignatureRequest.findUnique({
      where: { token },
      include: {
        devis: {
          include: {
            client: true,
            company: {
              select: { id: true, nom: true, adresse: true, email: true, telephone: true, siret: true },
            },
            createur: {
              select: { id: true, nom: true, prenom: true, email: true },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Lien de signature introuvable.');
    }

    const now = new Date();
    if (
      request.expiresAt < now &&
      request.statut !== 'SIGNE_CLIENT' &&
      request.statut !== 'ANNULE' &&
      request.statut !== 'EXPIRE'
    ) {
      await this.prisma.devisClientSignatureRequest.update({
        where: { id: request.id },
        data: { statut: 'EXPIRE' },
      });
      request.statut = 'EXPIRE';
    }

    return request;
  }

  private getSignatureRequestPublicState(statut: DevisClientSignatureStatut) {
    return {
      canRequestOtp: ['EN_ATTENTE', 'OTP_ENVOYE', 'OTP_VERIFIE'].includes(
        statut,
      ),
      canVerifyOtp: ['OTP_ENVOYE'].includes(statut),
      canSubmitSignature: ['OTP_VERIFIE'].includes(statut),
      isBlocked: statut === 'BLOQUE',
      isExpired: statut === 'EXPIRE',
      isSigned: statut === 'SIGNE_CLIENT',
    };
  }

  async create(dto: CreateDevisDto, createurId: number, companyId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
    });
    if (!client) {
      throw new NotFoundException(
        `Client #${dto.clientId} introuvable dans votre entreprise`,
      );
    }

    if (dto.demandeDevisId) {
      const demande = await this.prisma.demandeDevis.findFirst({
        where: { id: dto.demandeDevisId, companyId },
      });
      if (!demande) {
        throw new NotFoundException(
          `Demande de devis #${dto.demandeDevisId} introuvable`,
        );
      }

      const existingDraft = await this.prisma.devis.findFirst({
        where: {
          companyId,
          demandeDevisId: dto.demandeDevisId,
          statut: { in: ['BROUILLON', 'REVISE'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, nom: true, prenom: true } },
          createur: { select: { id: true, nom: true, prenom: true } },
        },
      });

      if (existingDraft) {
        return existingDraft;
      }
    }

    const maxCreateAttempts = 4;

    for (let attempt = 1; attempt <= maxCreateAttempts; attempt += 1) {
      const reference = await this.generateReference(companyId);

      try {
        const devis = await this.prisma.devis.create({
          data: {
            companyId,
            clientId: dto.clientId,
            createurId,
            demandeDevisId: dto.demandeDevisId,
            chantierId: dto.chantierId,
            reference,
            tauxTVA: dto.tauxTVA ?? 20,
            modeValidation: dto.modeValidation,
            notes: dto.notes,
          },
          include: {
            client: { select: { id: true, nom: true, prenom: true } },
            createur: { select: { id: true, nom: true, prenom: true } },
          },
        });

        await this.prisma.versionDevis.create({
          data: {
            devisId: devis.id,
            auteurId: createurId,
            numeroVersion: 1,
            justification: 'Creation initiale',
            totalHT: 0,
            totalTTC: 0,
            profit: 0,
            margePourcent: 0,
          },
        });

        return devis;
      } catch (error) {
        const shouldRetry =
          this.isReferenceUniqueConstraintError(error) &&
          attempt < maxCreateAttempts;

        if (shouldRetry) continue;
        throw error;
      }
    }

    throw new BadRequestException(
      'Impossible de creer le devis pour le moment. Veuillez reessayer.',
    );
  }

  async findAll(query: QueryDevisDto, companyId: number) {
    const { page = 1, limit = 20, statut, clientId, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };

    if (statut) where.statut = statut;
    if (clientId) where.clientId = clientId;
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.devis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              telephone: true,
              email: true,
            },
          },
          createur: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true, versions: true } },
        },
      }),
      this.prisma.devis.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, companyId: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        company: {
          select: { id: true, nom: true, adresse: true, email: true, telephone: true, siret: true },
        },
        createur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        demandeDevis: { select: { id: true, description: true, statut: true } },
        factures: { orderBy: { createdAt: 'desc' } },
        bonCommande: true,
        commandesFournisseur: {
          orderBy: { createdAt: 'asc' },
          include: {
            fournisseur: { select: { id: true, nom: true, email: true } },
            lignes: true,
          },
        },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            prestation: { select: { id: true, nom: true } },
            materiau: { select: { id: true, nom: true } },
            serviceMainOeuvre: { select: { id: true, nom: true } },
          },
        },
        versions: { orderBy: { numeroVersion: 'desc' } },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${id} introuvable`);
    }

    return devis;
  }

  async update(id: number, dto: UpdateDevisDto, companyId: number, userId?: number) {
    const devis = await this.findOne(id, companyId);

    if (devis.statut === 'SIGNE' || devis.statut === 'ANNULE') {
      throw new ForbiddenException(
        `Impossible de modifier un devis au statut ${devis.statut}`,
      );
    }

    return this.prisma.devis.update({
      where: { id },
      data: {
        tauxTVA: dto.tauxTVA,
        modeValidation: dto.modeValidation,
        notes: dto.notes,
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async updateStatut(id: number, dto: UpdateDevisStatutDto, companyId: number, userId?: number) {
    const devis = await this.findOne(id, companyId);
    const current = devis.statut as string;
    const next = dto.statut as string;

    this.workflowStateService.validateTransition(current, next);

    if ((next === 'SIGNE' || next === 'ACCEPTE' || next === 'ENVOYE') && devis.lignes.length === 0) {
      throw new BadRequestException('Impossible de valider ou signer un devis vide.');
    }

    const updateData: Record<string, unknown> = { statut: next as DevisStatut };

    if (next === 'ENVOYE' || next === 'RENVOYE') {
      updateData.dateEnvoi = new Date();
    }

    if (next === 'ACCEPTE' || next === 'SIGNE') {
      updateData.dateValidation = new Date();
    }

    if (next === 'REVISE') {
      const lignes = await this.prisma.ligneDevis.findMany({
        where: { devisId: id },
        orderBy: { ordre: 'asc' },
      });
      const newVersion = devis.versionCourante + 1;
      updateData.versionCourante = newVersion;

      await this.prisma.versionDevis.create({
        data: {
          devisId: id,
          auteurId: devis.createurId,
          numeroVersion: newVersion,
          justification: 'Revision apres refus',
          snapshotLignes: JSON.parse(JSON.stringify(lignes)),
          totalHT: devis.totalHT,
          totalTTC: devis.totalTTC,
          profit: devis.profit,
          margePourcent: devis.margePourcent,
        },
      });
    }

    const updatedDevis = await this.prisma.devis.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        versions: { orderBy: { numeroVersion: 'desc' }, take: 1 },
      },
    });

    const generated =
      next === 'ACCEPTE' || next === 'SIGNE'
        ? await this.ensureAcceptedDocumentsGenerated(id, companyId)
        : null;

    if (next === 'ACCEPTE' || next === 'SIGNE') {
      await this.checkDevisProfitabilityAndNotify(id, companyId);
    }

    return {
      devis: await this.findOne(id, companyId),
      generated,
      previousStatut: current,
      currentStatut: updatedDevis.statut,
    };
  }

  async sendToClient(id: number, companyId: number) {
    const devis = await this.getDevisForClientValidation(id, companyId);

    if (!devis.client.email) {
      throw new BadRequestException(
        'Le client doit avoir une adresse email avant l envoi du devis.',
      );
    }

    if (devis.lignes.length === 0) {
      throw new BadRequestException(
        'Impossible d envoyer un devis vide au client.',
      );
    }

    if (!['BROUILLON', 'REVISE', 'ENVOYE', 'RENVOYE'].includes(devis.statut)) {
      throw new ForbiddenException(
        `Le devis ${devis.reference} ne peut pas etre envoye au client depuis le statut ${devis.statut}.`,
      );
    }

    const token = this.createValidationToken({
      type: 'devis_validation',
      devisId: devis.id,
      clientId: devis.clientId,
      companyId: devis.companyId,
    });

    const tokenParam = encodeURIComponent(token);
    const validationUrl = `${this.getFrontendBaseUrl()}/validation-devis?token=${tokenParam}`;
    const acceptUrl = `${validationUrl}&decision=${ClientValidationDecision.ACCEPTE}`;
    const rejectUrl = `${validationUrl}&decision=${ClientValidationDecision.REFUSE}`;

    await this.mailService.sendDevisValidationEmail({
      to: devis.client.email,
      clientName:
        `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim() ||
        devis.client.nom,
      devisReference: devis.reference,
      totalTTC: devis.totalTTC,
      conseillerName:
        devis.createur?.prenom && devis.createur?.nom
          ? `${devis.createur.prenom} ${devis.createur.nom}`
          : 'Conseiller CRM',
      companyName: devis.company?.nom ?? 'CRM Batiment',
      validationUrl,
      acceptUrl,
      rejectUrl,
      companyEmail: devis.company?.email ?? undefined,
      companyTelephone: devis.company?.telephone ?? undefined,
      companyAdresse: devis.company?.adresse ?? undefined,
      companySiret: devis.company?.siret ?? undefined,
      clientAdresse: devis.client.adresseChantier ?? devis.client.adresseClient ?? undefined,
      clientEmail: devis.client.email ?? undefined,
      clientTelephone: devis.client.telephone ?? undefined,
      lines: devis.lignes.map((line) => ({
        description: line.description ?? line.prestation?.nom ?? 'Ligne devis',
        quantite: line.quantite,
        unite: line.unite,
        prixUnitaireHT: line.prixUnitaireVente,
        totalHT: line.totalHT,
        tauxTVA: devis.tauxTVA ?? 20,
      })),
    });

    const nextStatus: DevisStatut =
      devis.statut === 'REVISE'
        ? 'RENVOYE'
        : devis.statut === 'BROUILLON'
          ? 'ENVOYE'
          : (devis.statut as DevisStatut);

    const updatedDevis = await this.prisma.devis.update({
      where: { id },
      data: {
        statut: nextStatus,
        dateEnvoi: new Date(),
        modeValidation: devis.modeValidation ?? 'EMAIL',
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    return {
      message: `Devis ${devis.reference} envoye au client ${devis.client.email}.`,
      sentTo: devis.client.email,
      validationUrl,
      acceptUrl,
      rejectUrl,
      devis: updatedDevis,
    };
  }

  async getClientValidationPreview(token: string) {
    if (!token) {
      throw new BadRequestException('Le token de validation est obligatoire.');
    }

    const payload = this.verifyValidationToken(token);
    const devis = await this.getDevisForClientValidation(
      payload.devisId,
      payload.companyId,
      payload.clientId,
    );

    return {
      devis,
      canRespond: ['ENVOYE', 'RENVOYE'].includes(devis.statut),
      decisionTaken:
        devis.statut === 'ACCEPTE'
          ? ClientValidationDecision.ACCEPTE
          : devis.statut === 'REFUSE'
            ? ClientValidationDecision.REFUSE
            : null,
    };
  }

  async respondToClientValidation(dto: RespondClientValidationDto) {
    const payload = this.verifyValidationToken(dto.token);
    const devis = await this.getDevisForClientValidation(
      payload.devisId,
      payload.companyId,
      payload.clientId,
    );

    if (devis.statut === 'ACCEPTE') {
      return {
        message: 'Ce devis a deja ete accepte.',
        devis,
      };
    }

    if (devis.statut === 'REFUSE') {
      return {
        message: 'Ce devis a deja ete refuse.',
        devis,
      };
    }

    if (!['ENVOYE', 'RENVOYE'].includes(devis.statut)) {
      throw new ForbiddenException(
        `Le devis ${devis.reference} n est plus en attente de validation client.`,
      );
    }

    const data =
      dto.decision === ClientValidationDecision.ACCEPTE
        ? { statut: 'ACCEPTE' as DevisStatut, dateValidation: new Date() }
        : { statut: 'REFUSE' as DevisStatut };

    const updatedDevis = await this.prisma.devis.update({
      where: { id: devis.id },
      data,
      include: {
        client: true,
        createur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            prestation: { select: { id: true, nom: true } },
            materiau: { select: { id: true, nom: true } },
            serviceMainOeuvre: { select: { id: true, nom: true } },
          },
        },
      },
    });

    const generated =
      dto.decision === ClientValidationDecision.ACCEPTE
        ? await this.ensureAcceptedDocumentsGenerated(
            devis.id,
            payload.companyId,
          )
        : null;

    return {
      message:
        dto.decision === ClientValidationDecision.ACCEPTE
          ? `Le devis ${devis.reference} a ete accepte par le client.`
          : `Le devis ${devis.reference} a ete refuse par le client.`,
      devis:
        dto.decision === ClientValidationDecision.ACCEPTE
          ? await this.findOne(devis.id, payload.companyId)
          : updatedDevis,
      generated,
    };
  }

  async getSignatureOverview(id: number, companyId: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId },
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
          },
        },
        createur: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
          },
        },
        signatureRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${id} introuvable`);
    }

    const latestRequest = devis.signatureRequests[0] ?? null;
    if (
      latestRequest &&
      latestRequest.expiresAt < new Date() &&
      !['SIGNE_CLIENT', 'ANNULE', 'EXPIRE'].includes(latestRequest.statut)
    ) {
      await this.prisma.devisClientSignatureRequest.update({
        where: { id: latestRequest.id },
        data: { statut: 'EXPIRE' },
      });
      latestRequest.statut = 'EXPIRE';
    }

    return {
      devis: {
        ...devis,
        signatureRequests: undefined,
      },
      latestRequest,
      requests: devis.signatureRequests,
      signatureReadiness: {
        clientSigned: Boolean(
          devis.signatureClientBase64 && devis.signatureClientDate,
        ),
        conseillerSigned: Boolean(
          devis.signatureConseillerBase64 && devis.signatureConseillerDate,
        ),
        canApposeConseillerSignature:
          (devis.modeValidation === 'VERBAL'
            ? ['ENVOYE', 'RENVOYE', 'ACCEPTE', 'SIGNE'].includes(devis.statut)
            : ['ACCEPTE', 'SIGNE'].includes(devis.statut)) &&
          (devis.modeValidation === 'VERBAL' ||
            Boolean(devis.signatureClientBase64 && devis.signatureClientDate)),
        isComplete: devis.statut === 'SIGNE',
      },
    };
  }

  async sendClientSignatureRequest(
    id: number,
    dto: SendClientSignatureDto,
    companyId: number,
  ) {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId },
      include: {
        client: {
          select: { id: true, nom: true, prenom: true, telephone: true },
        },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${id} introuvable`);
    }

    if (!['ACCEPTE', 'SIGNE'].includes(devis.statut)) {
      throw new ForbiddenException(
        'La demande de signature client est disponible uniquement sur un devis accepte.',
      );
    }

    const providedPhone = dto.telephone?.trim();
    const sourcePhone = providedPhone || devis.client.telephone;
    if (!sourcePhone) {
      throw new BadRequestException(
        'Le client doit avoir un numero de telephone pour la signature par SMS.',
      );
    }

    const normalizedPhone = this.normalizePhone(sourcePhone);
    if (normalizedPhone.length < 8) {
      throw new BadRequestException(
        'Numero de telephone invalide pour l envoi OTP.',
      );
    }

    const expiresInHours = dto.expiresInHours ?? 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    const token = randomUUID();

    await this.prisma.devisClientSignatureRequest.updateMany({
      where: {
        devisId: devis.id,
        statut: { in: ['EN_ATTENTE', 'OTP_ENVOYE', 'OTP_VERIFIE'] },
      },
      data: { statut: 'ANNULE' },
    });

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: { modeValidation: 'SIGNATURE' },
    });

    const request = await this.prisma.devisClientSignatureRequest.create({
      data: {
        devisId: devis.id,
        token,
        telephoneClient: normalizedPhone,
        expiresAt,
        statut: 'EN_ATTENTE',
      },
    });

    const signatureUrl = `${this.getFrontendBaseUrl()}/sign/${token}`;
    await this.sendSms(
      normalizedPhone,
      `Signez votre devis ${devis.reference}: ${signatureUrl} (valide ${expiresInHours}h).`,
    );

    return {
      message: `Lien de signature envoye au client (${this.maskPhone(normalizedPhone)}).`,
      requestId: request.id,
      statut: request.statut,
      expiresAt: request.expiresAt,
      signatureUrl,
    };
  }

  async getPublicSignaturePreview(token: string) {
    const request = await this.getSignatureRequestByToken(token);
    const state = this.getSignatureRequestPublicState(request.statut);

    if (state.isExpired) {
      throw new BadRequestException('Lien expire ou invalide.');
    }

    const clientName =
      `${request.devis.client.prenom ?? ''} ${request.devis.client.nom}`.trim() ||
      request.devis.client.nom;

    return {
      token,
      statut: request.statut,
      expiresAt: request.expiresAt,
      telephoneMasked: this.maskPhone(request.telephoneClient),
      otpAttempts: request.otpAttempts,
      clientName,
      devis: {
        id: request.devis.id,
        reference: request.devis.reference,
        statut: request.devis.statut,
        totalTTC: request.devis.totalTTC,
        signatureClientDate: request.devis.signatureClientDate,
        signatureConseillerDate: request.devis.signatureConseillerDate,
      },
      ...state,
    };
  }

  async sendPublicSignatureOtp(token: string) {
    const request = await this.getSignatureRequestByToken(token);
    const state = this.getSignatureRequestPublicState(request.statut);

    if (state.isExpired) {
      throw new BadRequestException('Lien de signature expire.');
    }

    if (state.isBlocked || request.otpAttempts >= MAX_SIGNATURE_OTP_ATTEMPTS) {
      await this.prisma.devisClientSignatureRequest.update({
        where: { id: request.id },
        data: { statut: 'BLOQUE', blockedAt: new Date() },
      });
      throw new ForbiddenException(
        'Le lien est bloque apres trop de tentatives OTP. Contactez votre conseiller.',
      );
    }

    if (state.isSigned) {
      return {
        message: 'Ce devis est deja signe par le client.',
      };
    }

    const otpCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.devisClientSignatureRequest.update({
      where: { id: request.id },
      data: {
        otpCodeHash: this.hashValue(otpCode),
        otpExpiresAt,
        otpSentAt: new Date(),
        statut: 'OTP_ENVOYE',
      },
    });

    await this.sendSms(
      request.telephoneClient,
      `Votre code OTP CRM Batiment est ${otpCode}. Valable 5 minutes.`,
    );

    const response: Record<string, unknown> = {
      message: 'Code OTP envoye par SMS.',
      otpExpiresAt,
      remainingAttempts: MAX_SIGNATURE_OTP_ATTEMPTS - request.otpAttempts,
    };

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      response.debugOtp = otpCode;
    }

    return response;
  }

  async verifyPublicSignatureOtp(token: string, dto: VerifySignatureOtpDto) {
    const request = await this.getSignatureRequestByToken(token);
    const state = this.getSignatureRequestPublicState(request.statut);

    if (state.isExpired) {
      throw new BadRequestException('Lien de signature expire.');
    }

    if (state.isBlocked || request.otpAttempts >= MAX_SIGNATURE_OTP_ATTEMPTS) {
      throw new ForbiddenException(
        'Le lien est bloque apres trop de tentatives OTP. Contactez votre conseiller.',
      );
    }

    if (state.isSigned) {
      throw new BadRequestException('Ce devis est deja signe.');
    }

    if (!request.otpCodeHash || !request.otpExpiresAt) {
      throw new BadRequestException(
        'Aucun OTP actif. Veuillez demander un nouveau code.',
      );
    }

    if (request.otpExpiresAt < new Date()) {
      throw new BadRequestException(
        'Le code OTP a expire. Demandez un nouveau code.',
      );
    }

    if (!this.isMatchingHash(dto.otpCode, request.otpCodeHash)) {
      const nextAttempts = request.otpAttempts + 1;
      const mustBlock = nextAttempts >= MAX_SIGNATURE_OTP_ATTEMPTS;

      await this.prisma.devisClientSignatureRequest.update({
        where: { id: request.id },
        data: {
          otpAttempts: nextAttempts,
          ...(mustBlock ? { statut: 'BLOQUE', blockedAt: new Date() } : {}),
        },
      });

      if (mustBlock) {
        throw new ForbiddenException(
          'Code incorrect. Lien bloque apres 3 tentatives.',
        );
      }

      throw new BadRequestException(
        `Code OTP incorrect. Tentatives restantes: ${MAX_SIGNATURE_OTP_ATTEMPTS - nextAttempts}.`,
      );
    }

    const sessionToken = this.createSignatureSessionToken({
      type: 'devis_signature_session',
      requestId: request.id,
      devisId: request.devisId,
      companyId: request.devis.companyId,
    });

    await this.prisma.devisClientSignatureRequest.update({
      where: { id: request.id },
      data: {
        statut: 'OTP_VERIFIE',
        otpVerifiedAt: new Date(),
        otpAttempts: 0,
      },
    });

    return {
      message: 'OTP verifie. Vous pouvez signer le devis.',
      sessionToken,
      sessionExpiresInMinutes: 30,
    };
  }

  async submitPublicClientSignature(
    token: string,
    dto: SubmitClientSignatureDto,
  ) {
    this.ensureSignatureDataUrl(dto.signatureBase64);

    const request = await this.getSignatureRequestByToken(token);
    const state = this.getSignatureRequestPublicState(request.statut);

    if (state.isExpired) {
      throw new BadRequestException('Lien de signature expire.');
    }

    if (state.isBlocked) {
      throw new ForbiddenException('Lien de signature bloque.');
    }

    if (request.statut === 'SIGNE_CLIENT') {
      return {
        message: 'Le devis est deja signe par le client.',
        signedAt: request.clientSignedAt,
      };
    }

    if (request.statut !== 'OTP_VERIFIE') {
      throw new ForbiddenException(
        'Vous devez verifier le code OTP avant de signer le devis.',
      );
    }

    const sessionPayload = this.verifySignatureSessionToken(dto.sessionToken);
    if (
      sessionPayload.requestId !== request.id ||
      sessionPayload.devisId !== request.devisId ||
      sessionPayload.companyId !== request.devis.companyId
    ) {
      throw new ForbiddenException(
        'Session OTP invalide pour cette signature.',
      );
    }

    const signedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.devisClientSignatureRequest.update({
        where: { id: request.id },
        data: {
          statut: 'SIGNE_CLIENT',
          clientSignedAt: signedAt,
        },
      });

      const data: Record<string, unknown> = {
        signatureClientBase64: dto.signatureBase64,
        signatureClientDate: signedAt,
      };

      if (request.devis.signatureConseillerBase64) {
        data.statut = 'SIGNE';
        data.dateValidation = signedAt;
      }

      await tx.devis.update({
        where: { id: request.devisId },
        data,
      });
    });

    return {
      message:
        'Signature client enregistree. Votre conseiller sera notifie pour finaliser le dossier.',
      signedAt,
      nextStep: 'signature_conseiller',
    };
  }

  async apposeConseillerSignature(
    id: number,
    companyId: number,
    conseillerId: number,
  ) {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${id} introuvable`);
    }

    const isValidationVerbale = devis.modeValidation === 'VERBAL';
    const allowedStatutsForSignature = isValidationVerbale
      ? ['ENVOYE', 'RENVOYE', 'ACCEPTE', 'SIGNE']
      : ['ACCEPTE', 'SIGNE'];

    if (!allowedStatutsForSignature.includes(devis.statut)) {
      throw new ForbiddenException(
        isValidationVerbale
          ? 'Le devis doit etre envoye ou accepte avant d apposer la signature conseiller.'
          : 'Le devis doit etre accepte avant d apposer la signature conseiller.',
      );
    }

    if (
      !isValidationVerbale &&
      (!devis.signatureClientBase64 || !devis.signatureClientDate)
    ) {
      throw new ForbiddenException(
        'La signature client est requise avant la signature du conseiller.',
      );
    }

    const conseiller = await this.prisma.user.findFirst({
      where: { id: conseillerId, companyId },
      select: { id: true, signatureBase64: true },
    });

    if (!conseiller?.signatureBase64) {
      throw new BadRequestException(
        'Veuillez d abord configurer votre signature dans votre profil.',
      );
    }

    const signedAt = new Date();
    const updated = await this.prisma.devis.update({
      where: { id: devis.id },
      data: {
        signatureConseillerBase64: conseiller.signatureBase64,
        signatureConseillerDate: signedAt,
        statut: 'SIGNE',
        dateValidation: signedAt,
        ...(isValidationVerbale ? { modeValidation: 'VERBAL' } : {}),
        ...(isValidationVerbale && !devis.signatureClientDate
          ? { signatureClientDate: signedAt }
          : {}),
      },
    });

    await this.ensureAcceptedDocumentsGenerated(updated.id, companyId);
    await this.checkDevisProfitabilityAndNotify(updated.id, companyId);

    return {
      message:
        'Signature conseiller apposee. Statut dossier: signe_conseiller.',
      devis: await this.findOne(updated.id, companyId),
    };
  }

  async addLigne(devisId: number, dto: CreateLigneDevisDto, companyId: number) {
    const devis = await this.findOne(devisId, companyId);

    if (devis.statut !== 'BROUILLON' && devis.statut !== 'REVISE') {
      throw new ForbiddenException(
        'Les lignes ne peuvent etre modifiees que sur un devis en BROUILLON ou REVISE',
      );
    }

    let prixUnitaireVente = dto.prixUnitaireVente ?? 0;
    let prixAchat = dto.prixAchat ?? 0;
    let mainOeuvre = dto.mainOeuvre ?? 0;
    let description = dto.description;

    if (dto.prestationId) {
      const prestation = await this.prisma.prestation.findFirst({
        where: { id: dto.prestationId, companyId },
        include: {
          compositions: {
            include: {
              materiau: true,
              serviceMainOeuvre: true,
            },
          },
        },
      });

      if (prestation) {
        let coutMatParUnite = 0;
        let coutMoParUnite = 0;

        for (const composition of prestation.compositions) {
          if (composition.materiau) {
            coutMatParUnite +=
              composition.quantiteParUnite * composition.materiau.prixAchatFixe;
          }
          if (composition.serviceMainOeuvre) {
            coutMoParUnite +=
              composition.quantiteParUnite *
              composition.serviceMainOeuvre.prixUnitaire;
          }
        }

        if (dto.prixAchat === undefined || dto.prixAchat === null) {
          prixAchat = this.round2(coutMatParUnite);
        }
        if (dto.mainOeuvre === undefined || dto.mainOeuvre === null) {
          mainOeuvre = this.round2(coutMoParUnite);
        }
        if (
          dto.prixUnitaireVente === undefined ||
          dto.prixUnitaireVente === null
        ) {
          prixUnitaireVente =
            (prestation.prixVenteMin + prestation.prixVenteMax) / 2;
        }
        if (!description) {
          description = prestation.nom;
        }
      }
    }

    const totalHT = dto.quantite * prixUnitaireVente;
    const coutTotal = dto.quantite * (prixAchat + mainOeuvre);

    const ligne = await this.prisma.ligneDevis.create({
      data: {
        devisId,
        prestationId: dto.prestationId,
        materiauId: dto.materiauId,
        serviceMainOeuvreId: dto.serviceMainOeuvreId,
        description,
        quantite: dto.quantite,
        unite: dto.unite,
        dimension: dto.dimension,
        couleur: dto.couleur,
        finition: dto.finition,
        prixUnitaireVente,
        prixAchat,
        mainOeuvre,
        totalHT,
        coutTotal,
        ordre: dto.ordre ?? 0,
      },
    });

    await this.recalculerTotaux(devisId);
    return ligne;
  }

  async addLignesFromChecklist(
    devisId: number,
    items: {
      prestationId: number;
      quantite: number;
      selectedOptions?: { optionId: number; choixOptionIds: number[] }[];
    }[],
    companyId: number,
  ) {
    const devis = await this.findOne(devisId, companyId);

    if (devis.statut !== 'BROUILLON' && devis.statut !== 'REVISE') {
      throw new ForbiddenException(
        'Les lignes ne peuvent etre modifiees que sur un devis en BROUILLON ou REVISE',
      );
    }

    const lignes = [];
    let ordre = devis.lignes.length;

    for (const item of items) {
      const prestation = await this.prisma.prestation.findFirst({
        where: { id: item.prestationId, companyId },
        include: {
          compositions: {
            include: { materiau: true, serviceMainOeuvre: true },
          },
          options: {
            include: {
              choix: {
                where: { actif: true },
                include: {
                  compositions: {
                    include: { materiau: true, serviceMainOeuvre: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!prestation) continue;

      let coutMatParUnite = 0;
      let coutMoParUnite = 0;
      for (const composition of prestation.compositions) {
        if (composition.materiau) {
          coutMatParUnite +=
            composition.quantiteParUnite * composition.materiau.prixAchatFixe;
        }
        if (composition.serviceMainOeuvre) {
          coutMoParUnite +=
            composition.quantiteParUnite *
            composition.serviceMainOeuvre.prixUnitaire;
        }
      }

      const baseCostPerUnit = coutMatParUnite + coutMoParUnite;
      let optionImpactParUnite = 0;
      const selectedChoiceIds: number[] = [];
      const selectedChoiceLabels: string[] = [];

      for (const selectedOption of item.selectedOptions ?? []) {
        const option = prestation.options.find(
          (current) => current.id === selectedOption.optionId,
        );
        if (!option) continue;

        for (const choixId of selectedOption.choixOptionIds ?? []) {
          const choix = option.choix.find((current) => current.id === choixId);
          if (!choix) continue;

          const explicitImpact = choix.impactPrix ?? 0;
          if (explicitImpact !== 0) {
            optionImpactParUnite += explicitImpact;
          } else if ((choix.compositions?.length ?? 0) > 0) {
            const choiceCostPerUnit = this.calcCompositionsCostPerUnit(
              choix.compositions,
            );
            optionImpactParUnite += choiceCostPerUnit - baseCostPerUnit;
          }

          selectedChoiceIds.push(choix.id);
          selectedChoiceLabels.push(`${option.nom}: ${choix.nom}`);
        }
      }

      let selectedChoicesMatPerUnit = 0;
      let selectedChoicesLaborPerUnit = 0;
      if (selectedChoiceIds.length > 0) {
        const choiceCompositions =
          await this.prisma.choixOptionComposition.findMany({
            where: {
              choixOptionId: { in: selectedChoiceIds },
            },
            include: { materiau: true, serviceMainOeuvre: true },
          });

        for (const composition of choiceCompositions) {
          if (composition.materiau) {
            selectedChoicesMatPerUnit +=
              composition.quantiteParUnite * composition.materiau.prixAchatFixe;
          }
          if (composition.serviceMainOeuvre) {
            selectedChoicesLaborPerUnit +=
              composition.quantiteParUnite *
              composition.serviceMainOeuvre.prixUnitaire;
          }
        }
      }

      const useChoiceCompositions =
        selectedChoicesMatPerUnit > 0 || selectedChoicesLaborPerUnit > 0;
      const finalMatPerUnit = useChoiceCompositions
        ? selectedChoicesMatPerUnit
        : coutMatParUnite;
      const finalLaborPerUnit = useChoiceCompositions
        ? selectedChoicesLaborPerUnit
        : coutMoParUnite;

      const prixVente =
        (prestation.prixVenteMin + prestation.prixVenteMax) / 2 +
        optionImpactParUnite;
      const totalHT = item.quantite * prixVente;
      const coutTotal = item.quantite * (finalMatPerUnit + finalLaborPerUnit);

      const lineDescription =
        selectedChoiceLabels.length > 0
          ? `${prestation.nom} (${selectedChoiceLabels.join(', ')})`
          : prestation.nom;

      const ligne = await this.prisma.ligneDevis.create({
        data: {
          devisId,
          prestationId: item.prestationId,
          description: lineDescription,
          quantite: item.quantite,
          unite: prestation.unite,
          prixUnitaireVente: this.round2(prixVente),
          prixAchat: this.round2(finalMatPerUnit),
          mainOeuvre: this.round2(finalLaborPerUnit),
          totalHT: this.round2(totalHT),
          coutTotal: this.round2(coutTotal),
          ordre: ++ordre,
        },
      });

      lignes.push(ligne);
    }

    await this.recalculerTotaux(devisId);

    return { count: lignes.length, lignes };
  }

  async removeLigne(devisId: number, ligneId: number, companyId: number) {
    const devis = await this.findOne(devisId, companyId);

    if (devis.statut !== 'BROUILLON' && devis.statut !== 'REVISE') {
      throw new ForbiddenException(
        'Les lignes ne peuvent etre modifiees que sur un devis en BROUILLON ou REVISE',
      );
    }

    const ligne = await this.prisma.ligneDevis.findFirst({
      where: { id: ligneId, devisId },
    });
    if (!ligne) {
      throw new NotFoundException(
        `Ligne #${ligneId} introuvable dans ce devis`,
      );
    }

    await this.prisma.ligneDevis.delete({ where: { id: ligneId } });
    await this.recalculerTotaux(devisId);

    return { message: `Ligne #${ligneId} supprimee` };
  }

  async updateLigne(
    devisId: number,
    ligneId: number,
    dto: UpdateLigneDevisDto,
    companyId: number,
    userId?: number,
  ) {
    const devis = await this.findOne(devisId, companyId);

    if (devis.statut !== 'BROUILLON' && devis.statut !== 'REVISE') {
      throw new ForbiddenException(
        'Les lignes ne peuvent etre modifiees que sur un devis en BROUILLON ou REVISE',
      );
    }

    const existingLine = await this.prisma.ligneDevis.findFirst({
      where: { id: ligneId, devisId },
    });

    if (!existingLine) {
      throw new NotFoundException(
        `Ligne #${ligneId} introuvable dans ce devis`,
      );
    }

    let nextDescription =
      dto.description !== undefined
        ? dto.description
        : existingLine.description;
    let nextPrixUnitaireVente =
      dto.prixUnitaireVente !== undefined
        ? dto.prixUnitaireVente
        : existingLine.prixUnitaireVente;
    let nextPrixAchat =
      dto.prixAchat !== undefined ? dto.prixAchat : existingLine.prixAchat;
    let nextMainOeuvre =
      dto.mainOeuvre !== undefined ? dto.mainOeuvre : existingLine.mainOeuvre;

    if (dto.prestationId !== undefined && dto.prestationId !== null) {
      const prestation = await this.prisma.prestation.findFirst({
        where: { id: dto.prestationId, companyId },
        include: {
          compositions: {
            include: {
              materiau: true,
              serviceMainOeuvre: true,
            },
          },
        },
      });

      if (prestation) {
        let coutMatParUnite = 0;
        let coutMoParUnite = 0;

        for (const composition of prestation.compositions) {
          if (composition.materiau) {
            coutMatParUnite +=
              composition.quantiteParUnite * composition.materiau.prixAchatFixe;
          }
          if (composition.serviceMainOeuvre) {
            coutMoParUnite +=
              composition.quantiteParUnite *
              composition.serviceMainOeuvre.prixUnitaire;
          }
        }

        if (dto.prixAchat === undefined) {
          nextPrixAchat = this.round2(coutMatParUnite);
        }
        if (dto.mainOeuvre === undefined) {
          nextMainOeuvre = this.round2(coutMoParUnite);
        }
        if (dto.prixUnitaireVente === undefined) {
          nextPrixUnitaireVente =
            (prestation.prixVenteMin + prestation.prixVenteMax) / 2;
        }
        if (dto.description === undefined) {
          nextDescription = prestation.nom;
        }
      }
    }

    const nextQuantite = dto.quantite ?? existingLine.quantite;
    const safePrixAchat = nextPrixAchat ?? 0;
    const safeMainOeuvre = nextMainOeuvre ?? 0;
    const totalHT = this.round2(nextQuantite * nextPrixUnitaireVente);
    const coutTotal = this.round2(
      nextQuantite * (safePrixAchat + safeMainOeuvre),
    );

    const updatedLine = await this.prisma.ligneDevis.update({
      where: { id: ligneId },
      data: {
        prestationId:
          dto.prestationId !== undefined
            ? dto.prestationId
            : existingLine.prestationId,
        materiauId:
          dto.materiauId !== undefined
            ? dto.materiauId
            : existingLine.materiauId,
        serviceMainOeuvreId:
          dto.serviceMainOeuvreId !== undefined
            ? dto.serviceMainOeuvreId
            : existingLine.serviceMainOeuvreId,
        description: nextDescription,
        quantite: nextQuantite,
        unite: dto.unite !== undefined ? dto.unite : existingLine.unite,
        dimension:
          dto.dimension !== undefined ? dto.dimension : existingLine.dimension,
        couleur: dto.couleur !== undefined ? dto.couleur : existingLine.couleur,
        finition:
          dto.finition !== undefined ? dto.finition : existingLine.finition,
        prixUnitaireVente: nextPrixUnitaireVente,
        prixAchat: nextPrixAchat,
        mainOeuvre: nextMainOeuvre,
        totalHT,
        coutTotal,
        ordre: dto.ordre !== undefined ? dto.ordre : existingLine.ordre,
      },
    });

    await this.recalculerTotaux(devisId);
    return updatedLine;
  }

  private async recalculerTotaux(devisId: number) {
    const lignes = await this.prisma.ligneDevis.findMany({
      where: { devisId },
    });

    const totalHT = lignes.reduce((sum, ligne) => sum + ligne.totalHT, 0);
    const coutTotal = lignes.reduce((sum, ligne) => sum + ligne.coutTotal, 0);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      select: { tauxTVA: true },
    });

    const tauxTVA = devis?.tauxTVA ?? 20;
    const totalTVA = totalHT * (tauxTVA / 100);
    const totalTTC = totalHT + totalTVA;
    const profit = totalHT - coutTotal;
    const margePourcent = totalHT > 0 ? (profit / totalHT) * 100 : 0;

    await this.prisma.devis.update({
      where: { id: devisId },
      data: {
        totalHT: this.round2(totalHT),
        totalTVA: this.round2(totalTVA),
        totalTTC: this.round2(totalTTC),
        coutTotal: this.round2(coutTotal),
        profit: this.round2(profit),
        margePourcent: this.round2(margePourcent),
      },
    });
  }

  private async checkDevisProfitabilityAndNotify(
    devisId: number,
    companyId: number,
  ) {
    try {
      const devis = await this.prisma.devis.findFirst({
        where: { id: devisId, companyId },
        include: {
          client: { select: { nom: true, prenom: true } },
          lignes: {
            include: {
              materiau: true,
            },
          },
        },
      });

      if (!devis) return;

      let totalSellingHT = 0;
      let totalBuyingHT = 0;

      for (const line of devis.lignes) {
        const qty = line.quantite;
        totalSellingHT += line.prixUnitaireVente * qty;
        const buyingPrice =
          line.materiau?.prixAchatFixe ?? line.prixAchat ?? 0;
        totalBuyingHT += buyingPrice * qty;
      }

      const diff = totalSellingHT - totalBuyingHT;

      if (diff < 0) {
        await this.prisma.auditLog.create({
          data: {
            companyId,
            action: 'NOTIFICATION_ASSISTANT_URGENT_DEVIS',
            entite: 'devis',
            entiteId: devisId,
            nouvelleValeur: {
              audience: 'INTERNAL',
              category: 'SUPPLIER_STATUS',
              level: 'warning',
              title: `⚠️ Rentabilité : Perte de ${Math.abs(diff).toFixed(2)}€`,
              message: `Le devis ${devis.reference} pour ${devis.client.prenom} ${devis.client.nom} présente une perte de ${Math.abs(diff).toFixed(2)} € HT (Achat : ${totalBuyingHT.toFixed(2)} € HT, Vente : ${totalSellingHT.toFixed(2)} € HT).`,
              metadata: { devisId, loss: Math.abs(diff) },
            } as any,
          },
        });
      } else if (diff > 0) {
        const marginPercent =
          totalSellingHT > 0 ? (diff / totalSellingHT) * 100 : 0;
        await this.prisma.auditLog.create({
          data: {
            companyId,
            action: 'NOTIFICATION_ASSISTANT_URGENT_DEVIS',
            entite: 'devis',
            entiteId: devisId,
            nouvelleValeur: {
              audience: 'INTERNAL',
              category: 'SUPPLIER_STATUS',
              level: 'success',
              title: `🎉 Rentabilité : Gain de ${diff.toFixed(2)}€`,
              message: `Le devis ${devis.reference} pour ${devis.client.prenom} ${devis.client.nom} est rentable avec un gain de ${diff.toFixed(2)} € HT (Marge : ${marginPercent.toFixed(1)}%).`,
              metadata: { devisId, gain: diff, marginPercent },
            } as any,
          },
        });
      }
    } catch (error) {
      console.error('Erreur lors du calcul de rentabilité:', error);
    }
  }

  async remove(id: number, companyId: number, force?: boolean) {
    const devis = await this.findOne(id, companyId);

    if (devis.statut === 'SIGNE') {
      throw new ForbiddenException('Impossible de supprimer un devis signe');
    }

    return this.prisma.devis.delete({ where: { id } });
  }
}
