import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, parseSort, ReferencePrefix, ReferenceService, toSkipTake } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { CompanyService } from '../../core/company/company.service';
import { computeDevisTotals, isMarginAlert } from './devis.calculator';
import { assertEditable } from './devis-status';
import { DEVIS_CHANTIER_SELECT, DEVIS_DETAIL_SELECT, DEVIS_LIST_SELECT } from './devis.views';
import { CreateDevisDto, DEVIS_SORT_FIELDS, QueryDevisDto, UpdateDevisDto } from './dto/devis.dto';

export type DevisRow = Awaited<ReturnType<DevisService['getForUpdate']>>;

/** Quotes: read, create, update header, duplicate, delete drafts, keep totals right. */
@Injectable()
export class DevisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly company: CompanyService,
  ) {}

  // ── read ────────────────────────────────────────────────────────────────

  async findAll(user: AuthUser, query: QueryDevisDto) {
    // The role scope (e.g. a chef's own job sites) is ANDed with the filters: a filter or a
    // search can narrow it but never replace it (a spread let `chefChantierId: undefined`
    // or a search `OR` silently override the scope).
    const where: Prisma.DevisWhereInput = {
      AND: [
        this.scope(user),
        {
          statut: query.statuts?.length ? { in: query.statuts } : undefined,
          clientId: query.clientId,
          createurId: query.createurId,
          ...(query.search && {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { client: { nom: { contains: query.search, mode: 'insensitive' } } },
            ],
          }),
        },
      ],
    };
    const [rows, total, settings] = await Promise.all([
      this.prisma.devis.findMany({
        where,
        select: DEVIS_LIST_SELECT,
        orderBy: parseSort(query.sort, DEVIS_SORT_FIELDS, { dateCreation: 'desc' }),
        ...toSkipTake(query),
      }),
      this.prisma.devis.count({ where }),
      this.company.getSettingsRecord(user.companyId),
    ]);

    // A chef de chantier never sees amounts or margins
    const data = rows.map(({ margePourcent, totalHT, totalTTC, ...row }) =>
      user.role === Role.CHEF_CHANTIER
        ? row
        : {
            ...row,
            totalHT,
            totalTTC,
            margePourcent,
            alerteMarge: isMarginAlert({ totalHT, margePourcent }, settings.seuilAlerteMargePourcent),
          },
    );
    return paginate(data, total, query);
  }

  /** Internal detail (costs and margins), or the site view for a chef de chantier. */
  async findOne(user: AuthUser, id: number) {
    if (user.role === Role.CHEF_CHANTIER) {
      const devis = await this.prisma.devis.findFirst({ where: { id, ...this.scope(user) }, select: DEVIS_CHANTIER_SELECT });
      if (!devis) throw new NotFoundException(`Devis #${id} introuvable`);
      return devis;
    }

    const [devis, settings] = await Promise.all([
      this.prisma.devis.findFirst({ where: { id, companyId: user.companyId }, select: DEVIS_DETAIL_SELECT }),
      this.company.getSettingsRecord(user.companyId),
    ]);
    if (!devis) throw new NotFoundException(`Devis #${id} introuvable`);
    return { ...devis, alerteMarge: isMarginAlert(devis, settings.seuilAlerteMargePourcent) };
  }

  versions(user: AuthUser, id: number) {
    return this.prisma.versionDevis.findMany({
      where: { devisId: id, devis: { companyId: user.companyId } },
      orderBy: { numeroVersion: 'desc' },
      include: { auteur: { select: { id: true, nom: true, prenom: true } } },
    });
  }

  /** Internal row used by the other quote services (status checks, locks). */
  async getForUpdate(companyId: number, id: number, db: DbClient = this.prisma) {
    const devis = await db.devis.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        company: { select: { nom: true } },
        createur: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });
    if (!devis) throw new NotFoundException(`Devis #${id} introuvable`);
    return devis;
  }

  // ── write ───────────────────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreateDevisDto) {
    const devis = await this.prisma.$transaction((tx) => this.createDraft(tx, user, dto));
    return this.findOne(user, devis.id);
  }

  /**
   * Creates an empty draft. Exposed with `db` so the demande → devis conversion runs
   * in ONE transaction (the old conversion could leave a quote without updating the demande).
   */
  async createDraft(db: DbClient, user: AuthUser, dto: CreateDevisDto & { notes?: string | null }) {
    const client = await db.client.findFirst({ where: { id: dto.clientId, companyId: user.companyId } });
    if (!client) throw new BusinessException('CLIENT_INTROUVABLE', `Client #${dto.clientId} introuvable.`);
    if (client.archivedAt) throw new BusinessException('CLIENT_ARCHIVE', 'Ce client est archivé.');

    if (dto.demandeDevisId) {
      const demande = await db.demandeDevis.count({
        where: { id: dto.demandeDevisId, companyId: user.companyId, clientId: dto.clientId },
      });
      if (!demande) {
        throw new BusinessException('DEMANDE_INVALIDE', 'Demande introuvable ou rattachée à un autre client.');
      }
    }

    const tauxTVA = dto.tauxTVA ?? (await this.company.getSettingsRecord(user.companyId, db)).tvaDefaut;
    return db.devis.create({
      data: {
        companyId: user.companyId,
        clientId: dto.clientId,
        demandeDevisId: dto.demandeDevisId,
        createurId: user.id,
        reference: await this.references.next(ReferencePrefix.DEVIS, user.companyId, db),
        tauxTVA,
        notes: dto.notes,
      },
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateDevisDto) {
    await this.prisma.$transaction(async (tx) => {
      const devis = await this.getForUpdate(user.companyId, id, tx);
      assertEditable(devis.statut);
      await tx.devis.update({ where: { id }, data: dto });
      if (dto.tauxTVA !== undefined) await this.recalculate(tx, id);
    });
    return this.findOne(user, id);
  }

  /** New draft with the same client and lines (spec: "duplication"). Links and signatures are not copied. */
  async duplicate(user: AuthUser, id: number) {
    const copy = await this.prisma.$transaction(async (tx) => {
      const source = await this.getForUpdate(user.companyId, id, tx);
      const lignes = await tx.ligneDevis.findMany({ where: { devisId: id }, orderBy: { ordre: 'asc' } });

      const draft = await this.createDraft(tx, user, {
        clientId: source.clientId,
        tauxTVA: source.tauxTVA.toNumber(),
        notes: `Copie de ${source.reference}${source.notes ? `\n${source.notes}` : ''}`,
      });
      await tx.ligneDevis.createMany({
        data: lignes.map(({ id: _id, devisId: _devisId, createdAt: _c, updatedAt: _u, optionsChoisies, ...ligne }) => ({
          ...ligne,
          optionsChoisies: (optionsChoisies as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
          devisId: draft.id,
        })),
      });
      await this.recalculate(tx, draft.id);
      return draft;
    });
    return this.findOne(user, copy.id);
  }

  /** Only a draft that was never sent can disappear; anything else is cancelled (history kept). */
  async remove(user: AuthUser, id: number): Promise<void> {
    const devis = await this.getForUpdate(user.companyId, id);
    const versions = await this.prisma.versionDevis.count({ where: { devisId: id } });
    if (devis.statut !== 'BROUILLON' || versions > 0) {
      throw new BusinessException('DEVIS_NON_SUPPRIMABLE', 'Seul un brouillon jamais envoyé peut être supprimé. Annulez ce devis à la place.');
    }
    await this.prisma.devis.delete({ where: { id } });
  }

  /** Recomputes and stores the quote totals from its lines. Always call inside the write transaction. */
  async recalculate(db: DbClient, devisId: number): Promise<void> {
    const [devis, lignes] = await Promise.all([
      db.devis.findUniqueOrThrow({ where: { id: devisId }, select: { tauxTVA: true } }),
      db.ligneDevis.findMany({ where: { devisId }, select: { totalHT: true, coutTotal: true } }),
    ]);
    await db.devis.update({ where: { id: devisId }, data: computeDevisTotals(lignes, devis.tauxTVA) });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** A chef de chantier only sees the quotes of HIS job sites. */
  private scope(user: AuthUser): Prisma.DevisWhereInput {
    return user.role === Role.CHEF_CHANTIER
      ? { companyId: user.companyId, chantier: { chefChantierId: user.id } }
      : { companyId: user.companyId };
  }
}
