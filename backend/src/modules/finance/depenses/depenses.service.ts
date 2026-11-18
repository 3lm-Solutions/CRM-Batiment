import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AuthUser,
  BUREAU,
  BusinessException,
  paginate,
  ReferencePrefix,
  ReferenceService,
  toSkipTake,
} from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FICHIER_SELECT, FichiersService } from '../../core/storage/fichiers.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { assertMontants, fournisseurCle, normaliserNumero } from './depense-rules';
import type { CreerDepenseDto, ModifierDepenseDto, QueryDepensesDto } from './depenses.dto';
import { type DepenseEvent, DepenseEvents } from './depenses.events';

const DEPENSE_INCLUDE = {
  fournisseur: { select: { id: true, nom: true } },
  chantier: { select: { id: true, reference: true, adresse: true } },
  commandeFournisseur: { select: { id: true, reference: true } },
  createur: { select: { id: true, nom: true, prenom: true } },
  validePar: { select: { id: true, nom: true, prenom: true } },
  fichiers: { select: FICHIER_SELECT, orderBy: { id: 'asc' } },
} satisfies Prisma.DepenseInclude;

type Fournisseur = { fournisseurId: number | null; fournisseurNom: string };

/**
 * 18/11 (mobile lot A): supplier invoices photographed in the field (OCR on the phone).
 * Sent as BROUILLON, then VALIDEE or REFUSEE by ADMIN / ASSISTANTE (« Factures » tab of the
 * admin validations). The chef sends the amounts but never reads them back: the controller
 * strips them for him (amountsFor).
 */
@Injectable()
export class DepensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly fichiers: FichiersService,
    private readonly events: EventEmitter2,
  ) {}

  async creer(user: AuthUser, dto: CreerDepenseDto, file: UploadedBinary | undefined) {
    if (!file?.buffer?.length) {
      throw new BusinessException('FICHIER_MANQUANT', 'Ajoutez la photo de la facture.');
    }
    const fournisseur = await this.fournisseur(user, dto.fournisseurId, dto.fournisseurNom);
    assertMontants(dto.montantHT, dto.montantTVA, dto.montantTTC);
    await this.assertLiens(user, dto.chantierId, dto.commandeFournisseurId);
    const cle = fournisseurCle(fournisseur.fournisseurId, fournisseur.fournisseurNom);
    const numeroNormalise = normaliserNumero(dto.numeroFacture);
    await this.assertPasDeDoublon(user.companyId, cle, numeroNormalise);

    const position =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { latitude: dto.latitude, longitude: dto.longitude }
        : null;

    const depense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.depense.create({
        data: {
          companyId: user.companyId,
          reference: await this.references.next(ReferencePrefix.DEPENSE, user.companyId, tx),
          ...fournisseur,
          fournisseurCle: cle,
          numeroFacture: dto.numeroFacture,
          numeroNormalise,
          dateFacture: new Date(dto.dateFacture),
          montantHT: dto.montantHT,
          montantTVA: dto.montantTVA,
          montantTTC: dto.montantTTC,
          chantierId: dto.chantierId ?? null,
          commandeFournisseurId: dto.commandeFournisseurId ?? null,
          champsDouteux: dto.champsDouteux ?? [],
          notes: dto.notes ?? null,
          createurId: user.id,
        },
      });
      await this.fichiers.create(user, file, { depenseId: created.id }, tx, { position });
      return created;
    });

    this.events.emit(DepenseEvents.CREEE, this.event(user, depense));
    return this.detail(user, depense.id);
  }

  async liste(user: AuthUser, query: QueryDepensesDto) {
    const where: Prisma.DepenseWhereInput = {
      ...this.scope(user),
      ...(query.statut && { statut: query.statut }),
      ...(query.chantierId && { chantierId: query.chantierId }),
      ...(query.search && {
        OR: [
          { reference: { contains: query.search, mode: 'insensitive' } },
          { fournisseurNom: { contains: query.search, mode: 'insensitive' } },
          { numeroFacture: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.depense.findMany({
        where,
        include: DEPENSE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.depense.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async detail(user: AuthUser, id: number) {
    const depense = await this.prisma.depense.findFirst({
      where: { id, ...this.scope(user) },
      include: DEPENSE_INCLUDE,
    });
    // 404 rather than 403: never confirm that someone else's invoice exists
    if (!depense) throw new NotFoundException(`Dépense #${id} introuvable`);
    return depense;
  }

  async modifier(user: AuthUser, id: number, dto: ModifierDepenseDto) {
    const actuelle = await this.brouillon(user, id);
    const fournisseur =
      dto.fournisseurId !== undefined || dto.fournisseurNom !== undefined
        ? await this.fournisseur(
            user,
            dto.fournisseurId ?? null,
            dto.fournisseurNom ?? actuelle.fournisseurNom,
          )
        : { fournisseurId: actuelle.fournisseurId, fournisseurNom: actuelle.fournisseurNom };
    assertMontants(
      dto.montantHT ?? actuelle.montantHT.toNumber(),
      dto.montantTVA ?? actuelle.montantTVA.toNumber(),
      dto.montantTTC ?? actuelle.montantTTC.toNumber(),
    );
    await this.assertLiens(user, dto.chantierId, dto.commandeFournisseurId);
    const cle = fournisseurCle(fournisseur.fournisseurId, fournisseur.fournisseurNom);
    const numeroFacture = dto.numeroFacture ?? actuelle.numeroFacture;
    const numeroNormalise = normaliserNumero(numeroFacture);
    await this.assertPasDeDoublon(user.companyId, cle, numeroNormalise, id);

    const { count } = await this.prisma.depense.updateMany({
      where: { id, statut: 'BROUILLON' },
      data: {
        ...fournisseur,
        fournisseurCle: cle,
        numeroFacture,
        numeroNormalise,
        ...(dto.dateFacture && { dateFacture: new Date(dto.dateFacture) }),
        ...(dto.montantHT !== undefined && { montantHT: dto.montantHT }),
        ...(dto.montantTVA !== undefined && { montantTVA: dto.montantTVA }),
        ...(dto.montantTTC !== undefined && { montantTTC: dto.montantTTC }),
        ...(dto.chantierId !== undefined && { chantierId: dto.chantierId }),
        ...(dto.commandeFournisseurId !== undefined && {
          commandeFournisseurId: dto.commandeFournisseurId,
        }),
        ...(dto.champsDouteux && { champsDouteux: dto.champsDouteux }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    if (!count) throw this.dejaDecidee();
    return this.detail(user, id);
  }

  /** Deletes a draft and its photos (bytes too). */
  async supprimer(user: AuthUser, id: number): Promise<void> {
    const depense = await this.brouillon(user, id);
    for (const f of depense.fichiers) await this.fichiers.remove(f.id);
    const { count } = await this.prisma.depense.deleteMany({ where: { id, statut: 'BROUILLON' } });
    if (!count) throw this.dejaDecidee();
  }

  async ajouterFichier(
    user: AuthUser,
    id: number,
    file: UploadedBinary | undefined,
    position: { latitude: number; longitude: number } | null,
  ) {
    await this.brouillon(user, id);
    return this.fichiers.create(user, file, { depenseId: id }, undefined, { position });
  }

  valider(user: AuthUser, id: number) {
    return this.decider(user, id, 'VALIDEE', null);
  }

  refuser(user: AuthUser, id: number, motif: string) {
    return this.decider(user, id, 'REFUSEE', motif);
  }

  /** Waiting for the office (« Factures » tab of the validations). */
  aValider(companyId: number) {
    return this.prisma.depense.count({ where: { companyId, statut: 'BROUILLON' } });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async decider(
    user: AuthUser,
    id: number,
    decision: 'VALIDEE' | 'REFUSEE',
    motif: string | null,
  ) {
    const depense = await this.detail(user, id);
    if (depense.statut !== 'BROUILLON') {
      throw new BusinessException('DEPENSE_DEJA_DECIDEE', 'Cette dépense a déjà été traitée.');
    }
    const { count } = await this.prisma.depense.updateMany({
      where: { id, statut: 'BROUILLON' },
      data: { statut: decision, motifRefus: motif, valideParId: user.id, valideLe: new Date() },
    });
    if (!count) {
      throw new BusinessException(
        'DEPENSE_MODIFIEE',
        'Cette dépense vient d’être traitée par quelqu’un d’autre. Rechargez.',
        409,
      );
    }
    this.events.emit(DepenseEvents.DECIDEE, { ...this.event(user, depense), decision, motif });
    return this.detail(user, id);
  }

  /** The draft, readable by this user (author or office); 422 once decided. */
  private async brouillon(user: AuthUser, id: number) {
    const depense = await this.detail(user, id);
    if (depense.statut !== 'BROUILLON') throw this.dejaDecidee();
    return depense;
  }

  private dejaDecidee() {
    return new BusinessException(
      'DEPENSE_NON_MODIFIABLE',
      'Cette dépense a déjà été validée ou refusée : elle ne peut plus changer.',
    );
  }

  /** A supplier from the list (same company) or a name read on the invoice. */
  private async fournisseur(
    user: AuthUser,
    fournisseurId: number | null | undefined,
    fournisseurNom: string | null | undefined,
  ): Promise<Fournisseur> {
    if (fournisseurId) {
      const f = await this.prisma.fournisseur.findFirst({
        where: { id: fournisseurId, companyId: user.companyId },
        select: { id: true, nom: true },
      });
      if (!f) throw new NotFoundException(`Fournisseur #${fournisseurId} introuvable`);
      return { fournisseurId: f.id, fournisseurNom: f.nom };
    }
    const nom = fournisseurNom?.trim();
    if (!nom) {
      throw new BusinessException(
        'FOURNISSEUR_MANQUANT',
        'Choisissez le fournisseur ou écrivez son nom.',
      );
    }
    return { fournisseurId: null, fournisseurNom: nom };
  }

  /** The job site and the order must be of this company — and of this chef for a chef. */
  private async assertLiens(
    user: AuthUser,
    chantierId: number | null | undefined,
    commandeId: number | null | undefined,
  ) {
    const chef = user.role === Role.CHEF_CHANTIER;
    if (chantierId) {
      const ok = await this.prisma.chantier.count({
        where: {
          id: chantierId,
          companyId: user.companyId,
          ...(chef && { chefChantierId: user.id }),
        },
      });
      if (!ok) throw new NotFoundException(`Chantier #${chantierId} introuvable`);
    }
    if (commandeId) {
      const ok = await this.prisma.commandeFournisseur.count({
        where: {
          id: commandeId,
          companyId: user.companyId,
          ...(chef && {
            OR: [
              { devis: { chantier: { chefChantierId: user.id } } },
              { chantier: { chefChantierId: user.id } },
            ],
          }),
        },
      });
      if (!ok) throw new NotFoundException(`Commande #${commandeId} introuvable`);
    }
  }

  /** Same supplier + same number (written any way) = the same invoice: 409 with the existing one. */
  private async assertPasDeDoublon(
    companyId: number,
    cle: string,
    numeroNormalise: string,
    saufId?: number,
  ) {
    const existante = await this.prisma.depense.findFirst({
      where: {
        companyId,
        fournisseurCle: cle,
        numeroNormalise,
        ...(saufId && { id: { not: saufId } }),
      },
      select: { id: true, reference: true, statut: true },
    });
    if (existante) {
      throw new BusinessException(
        'DEPENSE_EXISTANTE',
        `Cette facture a déjà été envoyée (${existante.reference}).`,
        409,
        { depenseId: existante.id, reference: existante.reference, statut: existante.statut },
      );
    }
  }

  /** Author: his own; office: all of the company. */
  private scope(user: AuthUser): Prisma.DepenseWhereInput {
    return BUREAU.includes(user.role)
      ? { companyId: user.companyId }
      : { companyId: user.companyId, createurId: user.id };
  }

  private event(
    user: AuthUser,
    d: {
      id: number;
      reference: string;
      fournisseurNom: string;
      numeroFacture: string;
      createurId: number | null;
    },
  ): DepenseEvent {
    return {
      companyId: user.companyId,
      depenseId: d.id,
      reference: d.reference,
      fournisseurNom: d.fournisseurNom,
      numeroFacture: d.numeroFacture,
      createurId: d.createurId,
      userId: user.id,
    };
  }
}
