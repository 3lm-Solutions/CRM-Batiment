import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, ReferencePrefix, ReferenceService, toSkipTake } from '../../../common';
import { ChantierStatut, Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FichiersService } from '../../core/storage/fichiers.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { ChantierMachine } from './chantier-status';
import { AccesSousTraitantsDto, CreateChantierDto, CreateDocumentDto, QueryChantiersDto, UpdateChantierDto } from './dto/chantiers.dto';
import { assertDateRange, chantierProgress } from './tache-rules';

const LIST_SELECT = {
  id: true,
  reference: true,
  statut: true,
  adresse: true,
  dateDebut: true,
  dateFin: true,
  client: { select: { id: true, nom: true, prenom: true } },
  chefChantier: { select: { id: true, nom: true, prenom: true } },
  taches: { select: { avancement: true } },
} satisfies Prisma.ChantierSelect;

/** What a quote can contribute to a job site (used by the workflow). */
export interface DevisForChantier {
  id: number;
  companyId: number;
  clientId: number;
  reference: string;
  chantierId: number | null;
  client: { adresseChantier: string | null; adresseClient: string | null };
}

@Injectable()
export class ChantiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly fichiers: FichiersService,
  ) {}

  // ── read ────────────────────────────────────────────────────────────────

  async findAll(user: AuthUser, query: QueryChantiersDto) {
    // The role scope (e.g. a chef's own job sites) is ANDed with the filters: a filter or a
    // search can narrow it but never replace it (a spread let `chefChantierId: undefined`
    // or a search `OR` silently override the scope).
    const where: Prisma.ChantierWhereInput = {
      AND: [
        this.scope(user),
        {
          statut: query.statuts?.length ? { in: query.statuts } : undefined,
          clientId: query.clientId,
          chefChantierId: query.chefChantierId,
          ...(query.search && {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { adresse: { contains: query.search, mode: 'insensitive' } },
              { client: { nom: { contains: query.search, mode: 'insensitive' } } },
            ],
          }),
        },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chantier.findMany({ where, select: LIST_SELECT, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
      this.prisma.chantier.count({ where }),
    ]);
    const data = rows.map(({ taches, ...c }) => ({ ...c, avancement: chantierProgress(taches), nombreTaches: taches.length }));
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const internal = user.role !== Role.SOUS_TRAITANT;
    const chantier = await this.prisma.chantier.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true, ...(internal && { email: true }) } },
        chefChantier: { select: { id: true, nom: true, prenom: true, telephone: true } },
        // Amounts only for the office (never for chef de chantier or sous-traitant)
        devis: {
          select: {
            id: true,
            reference: true,
            statut: true,
            ...(user.role !== Role.CHEF_CHANTIER && internal && { totalHT: true, totalTTC: true }),
          },
        },
        taches: {
          orderBy: { ordre: 'asc' },
          include: { affectations: { include: { user: { select: { id: true, nom: true, prenom: true, role: true } } } } },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        ...(internal && {
          sousTraitantsVisibles: { select: { user: { select: { id: true, nom: true, prenom: true } } } },
        }),
      },
    });
    if (!chantier) await this.notVisible(user, id);
    return { ...chantier!, avancement: chantierProgress(chantier!.taches) };
  }

  /** Throws 404 if the user may not see this job site. */
  async assertAccess(user: AuthUser, id: number, db: DbClient = this.prisma) {
    const chantier = await db.chantier.findFirst({ where: { id, ...this.scope(user) } });
    if (!chantier) await this.notVisible(user, id, db);
    return chantier!;
  }

  // ── write ───────────────────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreateChantierDto) {
    assertDateRange(dto.dateDebut, dto.dateFin);
    const client = await this.prisma.client.count({ where: { id: dto.clientId, companyId: user.companyId } });
    if (!client) throw new BusinessException('CLIENT_INTROUVABLE', `Client #${dto.clientId} introuvable.`);
    await this.assertChef(user.companyId, dto.chefChantierId);

    const created = await this.prisma.$transaction(async (tx) =>
      tx.chantier.create({
        data: {
          ...dto,
          companyId: user.companyId,
          reference: await this.references.next(ReferencePrefix.CHANTIER, user.companyId, tx),
        },
      }),
    );
    return this.findOne(user, created.id);
  }

  /**
   * P0.2 — job site from a signed quote, inside the signing transaction. Idempotent:
   * a quote already linked to a job site creates nothing.
   */
  async createFromDevis(tx: DbClient, devis: DevisForChantier): Promise<number> {
    if (devis.chantierId) return devis.chantierId;

    const lignes = await tx.ligneDevis.findMany({
      where: { devisId: devis.id },
      orderBy: { ordre: 'asc' },
      select: { description: true, quantite: true, unite: true },
    });
    const chantier = await tx.chantier.create({
      data: {
        companyId: devis.companyId,
        clientId: devis.clientId,
        reference: await this.references.next(ReferencePrefix.CHANTIER, devis.companyId, tx),
        adresse: devis.client.adresseChantier ?? devis.client.adresseClient ?? 'Adresse à préciser',
        statut: 'PLANIFIE',
        description: [
          `Travaux du devis ${devis.reference} :`,
          ...lignes.map((l) => `- ${l.description ?? 'Prestation'} (${l.quantite.toString()} ${l.unite})`),
        ].join('\n'),
      },
    });
    await tx.devis.update({ where: { id: devis.id }, data: { chantierId: chantier.id } });
    return chantier.id;
  }

  async update(user: AuthUser, id: number, dto: UpdateChantierDto) {
    const chantier = await this.assertAccess(user, id);
    if (dto.chefChantierId !== undefined && user.role === Role.CHEF_CHANTIER) {
      throw new BusinessException('CHEF_NON_MODIFIABLE', 'Seul le bureau peut changer le chef de chantier.');
    }
    assertDateRange(dto.dateDebut ?? chantier.dateDebut, dto.dateFin ?? chantier.dateFin);
    await this.assertChef(user.companyId, dto.chefChantierId);
    await this.prisma.chantier.update({ where: { id }, data: dto });
    return this.findOne(user, id);
  }

  /** demarrer / suspendre / reprendre / terminer / cloturer / annuler */
  async transition(user: AuthUser, id: number, to: ChantierStatut) {
    const chantier = await this.assertAccess(user, id);
    ChantierMachine.assert(chantier.statut, to);

    const dates: Prisma.ChantierUpdateManyMutationInput = {};
    if (to === 'EN_COURS' && !chantier.dateDebut) dates.dateDebut = new Date();
    if (to === 'TERMINE') dates.dateFin = new Date();

    const { count } = await this.prisma.chantier.updateMany({
      where: { id, statut: chantier.statut },
      data: { ...dates, statut: to },
    });
    if (!count) throw new BusinessException('CHANTIER_MODIFIE', 'Le chantier vient de changer de statut. Rechargez.');
    return this.findOne(user, id);
  }

  /** Which sous-traitant ACCOUNTS see this job site in their portal (full list replace). */
  async setAccesSousTraitants(user: AuthUser, id: number, dto: AccesSousTraitantsDto) {
    await this.assertAccess(user, id);
    const valid = await this.prisma.user.count({
      where: { id: { in: dto.userIds }, companyId: user.companyId, role: Role.SOUS_TRAITANT, actif: true },
    });
    if (valid !== dto.userIds.length) {
      throw new BusinessException('COMPTE_INVALIDE', 'Seuls des comptes sous-traitants actifs peuvent être autorisés.');
    }
    await this.prisma.$transaction([
      this.prisma.chantierSousTraitant.deleteMany({ where: { chantierId: id } }),
      this.prisma.chantierSousTraitant.createMany({ data: dto.userIds.map((userId) => ({ chantierId: id, userId })) }),
    ]);
    return this.findOne(user, id);
  }

  async savePlan2d(user: AuthUser, id: number, plan: Record<string, unknown>) {
    await this.assertAccess(user, id);
    await this.prisma.chantier.update({ where: { id }, data: { plan2d: plan as Prisma.InputJsonValue } });
    return { saved: true };
  }

  async removePlan2d(user: AuthUser, id: number) {
    await this.assertAccess(user, id);
    await this.prisma.chantier.update({ where: { id }, data: { plan2d: Prisma.JsonNull } });
  }

  /** A document is either an external link or an uploaded file (Step 11). */
  async addDocument(user: AuthUser, id: number, dto: CreateDocumentDto) {
    await this.assertAccess(user, id);
    if (!dto.url === !dto.fichierId) {
      throw new BusinessException('DOCUMENT_SOURCE', 'Indiquez soit un lien, soit un fichier déposé.');
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.fichierId) {
        const fichier = await this.fichiers.assertAttachable(user, dto.fichierId, tx);
        if (fichier.chantierId && fichier.chantierId !== id) {
          throw new BusinessException('FICHIER_AUTRE_CHANTIER', 'Ce fichier appartient à un autre chantier.');
        }
        // The file becomes readable by the people of this job site
        await tx.fichier.update({ where: { id: fichier.id }, data: { chantierId: id } });
      }
      return tx.documentChantier.create({
        data: { chantierId: id, nom: dto.nom, type: dto.type, url: dto.url ?? null, fichierId: dto.fichierId ?? null },
      });
    });
  }

  /** Removing an uploaded document also deletes its file. */
  async removeDocument(user: AuthUser, id: number, documentId: number) {
    await this.assertAccess(user, id);
    const document = await this.prisma.documentChantier.findFirst({ where: { id: documentId, chantierId: id } });
    if (!document) throw new NotFoundException(`Document #${documentId} introuvable`);
    await this.prisma.documentChantier.delete({ where: { id: documentId } });
    if (document.fichierId) await this.fichiers.remove(document.fichierId);
  }

  /**
   * Hard delete only for a job site created by mistake (no quote, no task done).
   * v2: the old delete silently detached the signed quotes from their job site.
   */
  async remove(user: AuthUser, id: number): Promise<void> {
    await this.assertAccess(user, id);
    const linked = await this.prisma.devis.count({ where: { chantierId: id } });
    if (linked) {
      throw new BusinessException('CHANTIER_LIE_A_UN_DEVIS', 'Ce chantier provient d’un devis : annulez-le au lieu de le supprimer.');
    }
    await this.prisma.chantier.delete({ where: { id } });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Chef de chantier: his job sites. Sous-traitant: job sites opened to his account. */
  /**
   * Always throws. A chef de chantier opening a job site of his company that is not assigned to
   * him gets a clear 403 instead of "introuvable"; everyone else gets the usual 404.
   */
  private async notVisible(user: AuthUser, id: number, db: DbClient = this.prisma): Promise<never> {
    if (user.role === Role.CHEF_CHANTIER && (await db.chantier.count({ where: { id, companyId: user.companyId } }))) {
      throw new ForbiddenException('Ce chantier ne vous est pas affecté — demandez à l’administrateur de vous l’attribuer.');
    }
    throw new NotFoundException(`Chantier #${id} introuvable`);
  }

  private scope(user: AuthUser): Prisma.ChantierWhereInput {
    switch (user.role) {
      case Role.CHEF_CHANTIER:
        return { companyId: user.companyId, chefChantierId: user.id };
      case Role.SOUS_TRAITANT:
        return { companyId: user.companyId, sousTraitantsVisibles: { some: { userId: user.id } } };
      default:
        return { companyId: user.companyId };
    }
  }

  private async assertChef(companyId: number, chefId: number | null | undefined): Promise<void> {
    if (!chefId) return;
    const ok = await this.prisma.user.count({ where: { id: chefId, companyId, role: Role.CHEF_CHANTIER, actif: true } });
    if (!ok) throw new BusinessException('CHEF_INVALIDE', 'Le chef de chantier doit être un compte CHEF_CHANTIER actif.');
  }
}
