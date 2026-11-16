import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFactureFromDevisDto } from './dto/create-facture-from-devis.dto.js';
import { CreateFactureLigneDto } from './dto/create-facture-ligne.dto.js';
import { QueryFacturesDevisDto } from './dto/query-factures-devis.dto.js';
import { QueryFacturesDto } from './dto/query-factures.dto.js';
import { SendFactureDto } from './dto/send-facture.dto.js';
import { UpdateFactureLigneDto } from './dto/update-facture-ligne.dto.js';
import { UpdateFactureStatutDto } from './dto/update-facture-statut.dto.js';
import { UpdateFactureDto } from './dto/update-facture.dto.js';

const factureInclude = {
  devis: {
    select: {
      id: true,
      reference: true,
      statut: true,
      tauxTVA: true,
      client: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          adresseClient: true,
          adresseChantier: true,
        },
      },
      company: {
        select: {
          id: true,
          nom: true,
          email: true,
          telephone: true,
          adresse: true,
          siret: true,
        },
      },
    },
  },
  lignes: {
    orderBy: { ordre: 'asc' },
  },
} satisfies Prisma.FactureInclude;

type FactureRecord = Prisma.FactureGetPayload<{
  include: typeof factureInclude;
}>;

interface ComputedTotals {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  acomptePercent: number | null;
  acompteMontant: number | null;
}

const DEFAULT_TVA_NOTICE = [
  'Taux de TVA : En l absence de contestation par ecrit, dans un delai d un mois a compter de la reception de la facture,',
  'le client est presume reconnaitre que :',
  '(1) les travaux sont effectues a un batiment d habitation dont la premiere occupation a eu lieu au cours d une annee',
  'civile qui precede d au moins dix ans (*) la date de la premiere facture relative a ces travaux,',
  '(2) qu apres l execution de ces travaux, l habitation est utilisee, exclusivement ou soit a titre principal comme logement',
  'prive et',
  '(3) que ces travaux sont fournis et factures a un consommateur final.',
  'Si au moins une de ces conditions n est pas remplie, le taux normal de TVA sera applicable et le client',
  'supportera la responsabilite quant au paiement de la taxe, des interets et des amendes dus.',
].join('\n');

@Injectable()
export class FacturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private parseNumber(value: unknown, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private toNullableString(value?: string | null) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private pickFirstNonEmpty(...values: Array<string | null | undefined>) {
    for (const value of values) {
      const normalized = this.toNullableString(value);
      if (normalized) return normalized;
    }
    return null;
  }

  private normalizeLigneInput(
    line: {
      description?: string;
      datePrestation?: string;
      quantite?: number;
      unite?: string;
      prixUnitaireHT?: number;
      tauxTVA?: number;
    },
    fallbackTVA: number,
    ordre: number,
  ) {
    const description = line.description?.trim() || 'Ligne facture';
    const quantite = Math.max(0, this.parseNumber(line.quantite));
    const unite = line.unite?.trim() || 'UNITE';
    const prixUnitaireHT = Math.max(0, this.parseNumber(line.prixUnitaireHT));
    const tauxTVA = Math.max(0, this.parseNumber(line.tauxTVA, fallbackTVA));
    const montantHT = this.round2(quantite * prixUnitaireHT);
    const montantTVA = this.round2((montantHT * tauxTVA) / 100);
    const montantTTC = this.round2(montantHT + montantTVA);

    return {
      description,
      datePrestation: line.datePrestation
        ? new Date(line.datePrestation)
        : null,
      quantite,
      unite,
      prixUnitaireHT,
      tauxTVA,
      montantHT,
      montantTVA,
      montantTTC,
      ordre,
    };
  }

  private computeTotals(
    lines: Array<{ montantHT: number; montantTVA: number; montantTTC: number }>,
    typeFacture: 'ACOMPTE' | 'FINALE',
    acomptePercent?: number | null,
    acompteMontant?: number | null,
  ): ComputedTotals {
    const baseHT = this.round2(
      lines.reduce((sum, line) => sum + line.montantHT, 0),
    );
    const baseTVA = this.round2(
      lines.reduce((sum, line) => sum + line.montantTVA, 0),
    );
    const baseTTC = this.round2(
      lines.reduce((sum, line) => sum + line.montantTTC, 0),
    );

    if (typeFacture !== 'ACOMPTE') {
      return {
        totalHT: baseHT,
        totalTVA: baseTVA,
        totalTTC: baseTTC,
        acomptePercent: null,
        acompteMontant: null,
      };
    }

    let ratio = 1;
    let computedPercent = this.parseNumber(acomptePercent, 0);

    if (computedPercent > 0) {
      computedPercent = Math.min(100, computedPercent);
      ratio = computedPercent / 100;
    } else if (this.parseNumber(acompteMontant, 0) > 0 && baseTTC > 0) {
      ratio = Math.min(1, this.parseNumber(acompteMontant, 0) / baseTTC);
      computedPercent = this.round2(ratio * 100);
    } else {
      computedPercent = 100;
      ratio = 1;
    }

    const totalHT = this.round2(baseHT * ratio);
    const totalTVA = this.round2(baseTVA * ratio);
    const totalTTC = this.round2(baseTTC * ratio);

    return {
      totalHT,
      totalTVA,
      totalTTC,
      acomptePercent: computedPercent,
      acompteMontant: totalTTC,
    };
  }

  private async generateReference() {
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const count = await this.prisma.facture.count({
        where: {
          reference: {
            startsWith: prefix,
          },
        },
      });
      const next = count + attempt;
      const reference = `${prefix}${String(next).padStart(4, '0')}`;
      const exists = await this.prisma.facture.findUnique({
        where: { reference },
        select: { id: true },
      });
      if (!exists) return reference;
    }

    throw new ConflictException(
      'Impossible de generer une reference facture unique.',
    );
  }

  private async getCompanyFactureOrFail(id: number, companyId: number) {
    const facture = await this.prisma.facture.findFirst({
      where: {
        id,
        devis: {
          is: {
            companyId,
          },
        },
      },
      include: factureInclude,
    });

    if (!facture) {
      throw new NotFoundException(`Facture #${id} introuvable.`);
    }

    return facture;
  }

  private ensureEditable(facture: { statut: string }) {
    if (facture.statut === 'PAYEE') {
      throw new BadRequestException('Une facture payee n est plus modifiable.');
    }
  }

  private mapFacture(facture: FactureRecord) {
    return {
      ...facture,
      editable: facture.statut !== 'PAYEE',
      linkedDevis: {
        id: facture.devis.id,
        reference: facture.devis.reference,
        statut: facture.devis.statut,
      },
    };
  }

  async listDevisSources(query: QueryFacturesDevisDto, companyId: number) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.DevisWhereInput = {
      companyId,
    };

    if (search) {
      where.OR = [
        {
          reference: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          client: {
            is: {
              nom: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          client: {
            is: {
              prenom: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.devis.count({ where }),
      this.prisma.devis.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
            },
          },
          factures: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              reference: true,
              statut: true,
              montantTTC: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: data.map((devis) => ({
        id: devis.id,
        reference: devis.reference,
        statut: devis.statut,
        createdAt: devis.createdAt,
        totalTTC: devis.totalTTC,
        client: devis.client,
        existingFacture: devis.factures[0] ?? null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findAll(query: QueryFacturesDto, companyId: number) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.FactureWhereInput = {
      devis: {
        is: {
          companyId,
        },
      },
    };

    if (query.statut) {
      where.statut = query.statut;
    }

    if (search) {
      where.OR = [
        {
          reference: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          referenceDevis: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          nomClient: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          prenomClient: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [total, factures] = await Promise.all([
      this.prisma.facture.count({ where }),
      this.prisma.facture.findMany({
        where,
        include: {
          devis: {
            select: {
              id: true,
              reference: true,
              statut: true,
              client: {
                select: {
                  nom: true,
                  prenom: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: factures,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createFromDevis(
    devisId: number,
    dto: CreateFactureFromDevisDto,
    companyId: number,
  ) {
    const devis = await this.prisma.devis.findFirst({
      where: {
        id: devisId,
        companyId,
      },
      include: {
        client: true,
        company: true,
        lignes: {
          orderBy: { ordre: 'asc' },
        },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} introuvable.`);
    }

    if (devis.statut === 'REFUSE') {
      throw new BadRequestException('Impossible de facturer un devis refusé.');
    }

    if (!['ACCEPTE', 'SIGNE'].includes(devis.statut)) {
      throw new BadRequestException(
        `Impossible de facturer un devis avec le statut ${devis.statut}. Le devis doit d'abord être accepté ou signé.`,
      );
    }

    const existing = await this.prisma.facture.findFirst({
      where: { devisId },
      orderBy: { createdAt: 'desc' },
      include: factureInclude,
    });

    const defaultTva = this.round2(this.parseNumber(devis.tauxTVA, 20));
    const normalizedLines = (devis.lignes ?? []).map((ligne, index) =>
      this.normalizeLigneInput(
        {
          description: ligne.description ?? `Ligne ${index + 1}`,
          quantite: ligne.quantite,
          unite: ligne.unite,
          prixUnitaireHT: ligne.prixUnitaireVente,
          tauxTVA: defaultTva,
        },
        defaultTva,
        index,
      ),
    );

    const typeFacture = dto.typeFacture ?? existing?.typeFacture ?? 'FINALE';
    const totals = this.computeTotals(
      normalizedLines,
      typeFacture,
      dto.acomptePercent,
      null,
    );

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    if (existing) {
      const fallbackNomClient = this.pickFirstNonEmpty(
        existing.nomClient,
        devis.client.nom,
      );
      const fallbackPrenomClient = this.pickFirstNonEmpty(
        existing.prenomClient,
        devis.client.prenom,
      );
      const fallbackEmailClient = this.pickFirstNonEmpty(
        existing.emailClient,
        devis.client.email,
      );
      const fallbackTelephoneClient = this.pickFirstNonEmpty(
        existing.telephoneClient,
        devis.client.telephone,
      );
      const fallbackAdresseClient = this.pickFirstNonEmpty(
        existing.adresseClient,
        devis.client.adresseChantier,
        devis.client.adresseClient,
      );
      const fallbackCompanyNom = this.pickFirstNonEmpty(
        existing.companyNom,
        devis.company.nom,
      );
      const fallbackCompanyEmail = this.pickFirstNonEmpty(
        existing.companyEmail,
        devis.company.email,
      );
      const fallbackCompanyTelephone = this.pickFirstNonEmpty(
        existing.companyTelephone,
        devis.company.telephone,
      );
      const fallbackCompanyAdresse = this.pickFirstNonEmpty(
        existing.companyAdresse,
        devis.company.adresse,
      );
      const fallbackCompanySiret = this.pickFirstNonEmpty(
        existing.companySiret,
        devis.company.siret,
      );
      const fallbackConditionsPaiement = this.pickFirstNonEmpty(
        existing.conditionsPaiement,
        'Paiement a 30 jours date de facture.',
      );
      const fallbackCommunicationPaiement = this.pickFirstNonEmpty(
        existing.communicationPaiement,
        `Facture ${existing.reference}`,
      );
      const fallbackReferencePaiement = this.pickFirstNonEmpty(
        existing.referencePaiement,
        existing.reference,
      );
      const fallbackNotesLegales = this.pickFirstNonEmpty(
        existing.notesLegales,
        DEFAULT_TVA_NOTICE,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.facture.update({
          where: { id: existing.id },
          data: {
            date: existing.date ?? issueDate,
            dateEcheance: existing.dateEcheance ?? dueDate,
            referenceDevis: devis.reference,
            tauxTVA: defaultTva,
            typeFacture,
            acomptePercent: totals.acomptePercent,
            acompteMontant: totals.acompteMontant,
            montantHT: totals.totalHT,
            montantTVA: totals.totalTVA,
            montantTTC: totals.totalTTC,
            nomClient: fallbackNomClient,
            prenomClient: fallbackPrenomClient,
            emailClient: fallbackEmailClient,
            telephoneClient: fallbackTelephoneClient,
            adresseClient: fallbackAdresseClient,
            companyNom: fallbackCompanyNom,
            companyEmail: fallbackCompanyEmail,
            companyTelephone: fallbackCompanyTelephone,
            companyAdresse: fallbackCompanyAdresse,
            companySiret: fallbackCompanySiret,
            conditionsPaiement: fallbackConditionsPaiement,
            communicationPaiement: fallbackCommunicationPaiement,
            referencePaiement: fallbackReferencePaiement,
            notesLegales: fallbackNotesLegales,
          },
        });

        if (
          (existing.lignes?.length ?? 0) === 0 &&
          normalizedLines.length > 0
        ) {
          await tx.factureLigne.createMany({
            data: normalizedLines.map((line) => ({
              factureId: existing.id,
              ...line,
            })),
          });
        }
      });

      const refreshed = await this.getCompanyFactureOrFail(
        existing.id,
        companyId,
      );
      return this.mapFacture(refreshed);
    }

    const reference = await this.generateReference();

    const created = await this.prisma.facture.create({
      data: {
        devisId,
        reference,
        date: issueDate,
        dateEcheance: dueDate,
        referenceDevis: devis.reference,
        tauxTVA: defaultTva,
        typeFacture,
        acomptePercent: totals.acomptePercent,
        acompteMontant: totals.acompteMontant,
        montantHT: totals.totalHT,
        montantTVA: totals.totalTVA,
        montantTTC: totals.totalTTC,
        nomClient: devis.client.nom,
        prenomClient: devis.client.prenom,
        emailClient: devis.client.email,
        telephoneClient: devis.client.telephone,
        adresseClient:
          devis.client.adresseChantier ?? devis.client.adresseClient,
        companyNom: devis.company.nom,
        companyEmail: devis.company.email,
        companyTelephone: devis.company.telephone,
        companyAdresse: devis.company.adresse,
        companySiret: devis.company.siret,
        conditionsPaiement: 'Paiement a 30 jours date de facture.',
        communicationPaiement: `Facture ${reference}`,
        referencePaiement: reference,
        notesLegales: DEFAULT_TVA_NOTICE,
        lignes: {
          create: normalizedLines,
        },
      },
      include: factureInclude,
    });

    return this.mapFacture(created);
  }

  async findOne(id: number, companyId: number) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);
    return this.mapFacture(facture);
  }

  async update(id: number, dto: UpdateFactureDto, companyId: number) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);
    this.ensureEditable(facture);

    if (dto.reference && dto.reference !== facture.reference) {
      const existingReference = await this.prisma.facture.findUnique({
        where: { reference: dto.reference },
        select: { id: true },
      });
      if (existingReference && existingReference.id !== facture.id) {
        throw new ConflictException('Cette reference facture existe deja.');
      }
    }

    const fallbackTVA = this.round2(
      this.parseNumber(dto.tauxTVA, facture.tauxTVA || 20),
    );

    const baseUpdate: Prisma.FactureUncheckedUpdateInput = {
      reference: this.toNullableString(dto.reference) ?? undefined,
      date: dto.date ? new Date(dto.date) : undefined,
      dateEcheance: dto.dateEcheance ? new Date(dto.dateEcheance) : undefined,
      tauxTVA: dto.tauxTVA !== undefined ? fallbackTVA : undefined,
      typeFacture: dto.typeFacture,
      companyNom:
        dto.companyNom !== undefined
          ? this.toNullableString(dto.companyNom)
          : undefined,
      companyEmail:
        dto.companyEmail !== undefined
          ? this.toNullableString(dto.companyEmail)
          : undefined,
      companyTelephone:
        dto.companyTelephone !== undefined
          ? this.toNullableString(dto.companyTelephone)
          : undefined,
      companyAdresse:
        dto.companyAdresse !== undefined
          ? this.toNullableString(dto.companyAdresse)
          : undefined,
      companySiret:
        dto.companySiret !== undefined
          ? this.toNullableString(dto.companySiret)
          : undefined,
      nomClient:
        dto.nomClient !== undefined
          ? this.toNullableString(dto.nomClient)
          : undefined,
      prenomClient:
        dto.prenomClient !== undefined
          ? this.toNullableString(dto.prenomClient)
          : undefined,
      emailClient:
        dto.emailClient !== undefined
          ? this.toNullableString(dto.emailClient)
          : undefined,
      telephoneClient:
        dto.telephoneClient !== undefined
          ? this.toNullableString(dto.telephoneClient)
          : undefined,
      adresseClient:
        dto.adresseClient !== undefined
          ? this.toNullableString(dto.adresseClient)
          : undefined,
      conditionsPaiement:
        dto.conditionsPaiement !== undefined
          ? this.toNullableString(dto.conditionsPaiement)
          : undefined,
      communicationPaiement:
        dto.communicationPaiement !== undefined
          ? this.toNullableString(dto.communicationPaiement)
          : undefined,
      notesLegales:
        dto.notesLegales !== undefined
          ? this.toNullableString(dto.notesLegales)
          : undefined,
      referencePaiement:
        dto.referencePaiement !== undefined
          ? this.toNullableString(dto.referencePaiement)
          : undefined,
      acomptePercent: dto.acomptePercent,
      acompteMontant: dto.acompteMontant,
    };

    if (dto.lignes) {
      const normalizedLines = dto.lignes.map((line, index) =>
        this.normalizeLigneInput(line, fallbackTVA, index),
      );
      const typeFacture = dto.typeFacture ?? facture.typeFacture;
      const totals = this.computeTotals(
        normalizedLines,
        typeFacture,
        dto.acomptePercent ?? facture.acomptePercent,
        dto.acompteMontant ?? facture.acompteMontant,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.facture.update({
          where: { id },
          data: {
            ...baseUpdate,
            tauxTVA: fallbackTVA,
            typeFacture,
            acomptePercent: totals.acomptePercent,
            acompteMontant: totals.acompteMontant,
            montantHT: totals.totalHT,
            montantTVA: totals.totalTVA,
            montantTTC: totals.totalTTC,
          },
        });

        await tx.factureLigne.deleteMany({ where: { factureId: id } });

        if (normalizedLines.length > 0) {
          await tx.factureLigne.createMany({
            data: normalizedLines.map((line) => ({ factureId: id, ...line })),
          });
        }
      });
    } else {
      const lineTotals = this.computeTotals(
        facture.lignes,
        dto.typeFacture ?? facture.typeFacture,
        dto.acomptePercent ?? facture.acomptePercent,
        dto.acompteMontant ?? facture.acompteMontant,
      );

      await this.prisma.facture.update({
        where: { id },
        data: {
          ...baseUpdate,
          montantHT: lineTotals.totalHT,
          montantTVA: lineTotals.totalTVA,
          montantTTC: lineTotals.totalTTC,
          acomptePercent: lineTotals.acomptePercent,
          acompteMontant: lineTotals.acompteMontant,
        },
      });
    }

    const refreshed = await this.getCompanyFactureOrFail(id, companyId);
    return this.mapFacture(refreshed);
  }

  private async refreshTotals(id: number, companyId: number) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);
    const totals = this.computeTotals(
      facture.lignes,
      facture.typeFacture,
      facture.acomptePercent,
      facture.acompteMontant,
    );

    await this.prisma.facture.update({
      where: { id },
      data: {
        montantHT: totals.totalHT,
        montantTVA: totals.totalTVA,
        montantTTC: totals.totalTTC,
        acomptePercent: totals.acomptePercent,
        acompteMontant: totals.acompteMontant,
      },
    });
  }

  async addLigne(id: number, dto: CreateFactureLigneDto, companyId: number) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);
    this.ensureEditable(facture);

    const ordre = facture.lignes.length;
    const line = this.normalizeLigneInput(dto, facture.tauxTVA || 20, ordre);

    await this.prisma.factureLigne.create({
      data: {
        factureId: id,
        ...line,
      },
    });

    await this.refreshTotals(id, companyId);
    return this.findOne(id, companyId);
  }

  async updateLigne(
    id: number,
    ligneId: number,
    dto: UpdateFactureLigneDto,
    companyId: number,
  ) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);
    this.ensureEditable(facture);

    const existing = facture.lignes.find((line) => line.id === ligneId);
    if (!existing) {
      throw new NotFoundException(`Ligne facture #${ligneId} introuvable.`);
    }

    const normalized = this.normalizeLigneInput(
      {
        description: dto.description ?? existing.description,
        datePrestation:
          dto.datePrestation ??
          existing.datePrestation?.toISOString() ??
          undefined,
        quantite: dto.quantite ?? existing.quantite,
        unite: dto.unite ?? existing.unite,
        prixUnitaireHT: dto.prixUnitaireHT ?? existing.prixUnitaireHT,
        tauxTVA: dto.tauxTVA ?? existing.tauxTVA,
      },
      facture.tauxTVA || 20,
      existing.ordre,
    );

    await this.prisma.factureLigne.update({
      where: { id: ligneId },
      data: normalized,
    });

    await this.refreshTotals(id, companyId);
    return this.findOne(id, companyId);
  }

  async removeLigne(id: number, ligneId: number, companyId: number) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);
    this.ensureEditable(facture);

    const existing = facture.lignes.find((line) => line.id === ligneId);
    if (!existing) {
      throw new NotFoundException(`Ligne facture #${ligneId} introuvable.`);
    }

    await this.prisma.factureLigne.delete({ where: { id: ligneId } });

    const remaining = await this.prisma.factureLigne.findMany({
      where: { factureId: id },
      orderBy: { ordre: 'asc' },
      select: { id: true },
    });

    for (const [index, line] of remaining.entries()) {
      await this.prisma.factureLigne.update({
        where: { id: line.id },
        data: { ordre: index },
      });
    }

    await this.refreshTotals(id, companyId);
    return this.findOne(id, companyId);
  }

  async updateStatut(
    id: number,
    dto: UpdateFactureStatutDto,
    companyId: number,
  ) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);

    if (facture.statut === 'PAYEE' && dto.statut !== 'PAYEE') {
      throw new BadRequestException(
        'Une facture payee ne peut pas revenir en arriere.',
      );
    }

    await this.prisma.facture.update({
      where: { id },
      data: {
        statut: dto.statut,
        datePaiement: dto.statut === 'PAYEE' ? new Date() : null,
      },
    });

    return this.findOne(id, companyId);
  }

  async sendToClient(id: number, dto: SendFactureDto, companyId: number) {
    const facture = await this.getCompanyFactureOrFail(id, companyId);

    if (facture.statut === 'ANNULEE') {
      throw new BadRequestException(
        'Impossible d envoyer une facture annulee.',
      );
    }

    const targetEmail =
      this.toNullableString(dto.email) ??
      this.toNullableString(facture.emailClient) ??
      this.toNullableString(facture.devis.client?.email ?? null);

    if (!targetEmail) {
      throw new BadRequestException(
        'Aucun email client disponible pour l envoi.',
      );
    }

    const clientDisplayName =
      `${facture.prenomClient ?? ''} ${facture.nomClient ?? ''}`.trim() ||
      `${facture.devis.client?.prenom ?? ''} ${facture.devis.client?.nom ?? ''}`.trim() ||
      'Client';

    await this.mailService.sendInvoiceEmail({
      to: targetEmail,
      clientName: clientDisplayName,
      invoiceReference: facture.reference,
      devisReference: facture.referenceDevis ?? facture.devis.reference,
      companyName: facture.companyNom ?? facture.devis.company.nom,
      amountTTC: facture.montantTTC,
      dueDate: facture.dateEcheance?.toISOString(),
      customMessage: this.toNullableString(dto.message) ?? undefined,
      companyEmail: facture.companyEmail ?? undefined,
      companyTelephone: facture.companyTelephone ?? undefined,
      companyAdresse: facture.companyAdresse ?? undefined,
      companySiret: facture.companySiret ?? undefined,
      clientAdresse: facture.adresseClient ?? undefined,
      clientEmail: facture.emailClient ?? undefined,
      clientTelephone: facture.telephoneClient ?? undefined,
      referencePaiement: facture.referencePaiement ?? undefined,
      notesLegales: facture.notesLegales ?? undefined,
      lines:
        facture.lignes.length > 0
          ? facture.lignes.map((line) => ({
              description: line.description,
              quantite: line.quantite,
              unite: line.unite,
              prixUnitaireHT: line.prixUnitaireHT,
              montantHT: line.montantHT,
              tauxTVA: line.tauxTVA,
            }))
          : [
              {
                description: `Facture d'acompte de ${
                  facture.acomptePercent ?? 30
                }% pour le devis ${
                  facture.referenceDevis ?? facture.devis.reference
                }`,
                quantite: 1,
                unite: 'FORFAIT',
                prixUnitaireHT: facture.montantHT ?? 0,
                montantHT: facture.montantHT ?? 0,
                tauxTVA: facture.tauxTVA ?? 20,
              },
            ],
    });

    await this.prisma.facture.update({
      where: { id },
      data: {
        statut: 'ENVOYEE',
        dateEnvoiClient: new Date(),
        emailEnvoiClient: targetEmail,
      },
    });

    const refreshed = await this.getCompanyFactureOrFail(id, companyId);

    return {
      message: `Facture ${refreshed.reference} envoyee a ${targetEmail}.`,
      facture: this.mapFacture(refreshed),
    };
  }
}
