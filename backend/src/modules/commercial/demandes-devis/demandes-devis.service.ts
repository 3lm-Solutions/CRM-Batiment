import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, parseSort, ReferencePrefix, ReferenceService, toSkipTake } from '../../../common';
import { DemandeStatut, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DevisService } from '../devis/devis.service';
import { assertDemandeTransition } from './demande-status';
import { CreateDemandeDevisDto, QueryDemandesDevisDto, UpdateDemandeDevisDto } from './dto/demandes-devis.dto';

const SORTABLE = ['reference', 'date', 'createdAt'] as const;
const INCLUDE = {
  client: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
  createur: { select: { id: true, nom: true, prenom: true } },
  devis: { select: { id: true, reference: true, statut: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.DemandeDevisInclude;

@Injectable()
export class DemandesDevisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly devis: DevisService,
  ) {}

  async findAll(user: AuthUser, query: QueryDemandesDevisDto) {
    const where: Prisma.DemandeDevisWhereInput = {
      companyId: user.companyId,
      statut: query.statuts?.length ? { in: query.statuts } : undefined,
      source: query.source,
      clientId: query.clientId,
      ...(query.search && {
        OR: [
          { reference: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { client: { nom: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.demandeDevis.findMany({
        where,
        include: INCLUDE,
        orderBy: parseSort(query.sort, SORTABLE, { createdAt: 'desc' }),
        ...toSkipTake(query),
      }),
      this.prisma.demandeDevis.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.demandeDevis.findFirst({ where: { id, companyId: user.companyId }, include: INCLUDE });
    if (!row) throw new NotFoundException(`Demande #${id} introuvable`);
    return row;
  }

  async create(user: AuthUser, dto: CreateDemandeDevisDto) {
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, companyId: user.companyId } });
    if (!client) throw new BusinessException('CLIENT_INTROUVABLE', `Client #${dto.clientId} introuvable.`);
    if (client.archivedAt) throw new BusinessException('CLIENT_ARCHIVE', 'Ce client est archivé.');

    return this.prisma.$transaction(async (tx) =>
      tx.demandeDevis.create({
        data: {
          ...dto,
          besoinStructure: dto.besoinStructure as Prisma.InputJsonValue | undefined,
          companyId: user.companyId,
          createurId: user.id,
          reference: await this.references.next(ReferencePrefix.DEMANDE, user.companyId, tx),
        },
        include: INCLUDE,
      }),
    );
  }

  async update(user: AuthUser, id: number, dto: UpdateDemandeDevisDto) {
    const demande = await this.findOne(user, id);
    if (demande.statut === 'CONVERTI') {
      throw new BusinessException('DEMANDE_CONVERTIE', 'Une demande convertie ne se modifie plus : modifiez le devis.');
    }
    return this.prisma.demandeDevis.update({
      where: { id },
      data: { ...dto, besoinStructure: dto.besoinStructure as Prisma.InputJsonValue | undefined },
      include: INCLUDE,
    });
  }

  /** prendre-en-charge / qualifier / perdre / reouvrir */
  async changerStatut(user: AuthUser, id: number, to: Exclude<DemandeStatut, 'CONVERTI'>) {
    const demande = await this.findOne(user, id);
    assertDemandeTransition(demande.statut, to);
    return this.prisma.demandeDevis.update({ where: { id }, data: { statut: to }, include: INCLUDE });
  }

  /**
   * P0.1 — demande → draft quote, in ONE transaction, idempotent.
   * v2 fixes: the reference came from `count + 1` (collides after deletions), there was no
   * transaction, and a 0 € placeholder line let an empty quote pass the "has lines" check.
   * The request description goes to the quote notes; lines are added from the catalogue.
   */
  async convertirEnDevis(user: AuthUser, id: number) {
    const devisId = await this.prisma.$transaction(async (tx) => {
      const demande = await tx.demandeDevis.findFirst({
        where: { id, companyId: user.companyId },
        include: { devis: { where: { statut: { not: 'ANNULE' } }, select: { id: true } } },
      });
      if (!demande) throw new NotFoundException(`Demande #${id} introuvable`);

      if (demande.devis.length > 0) return demande.devis[0].id; // already converted: same quote
      assertDemandeTransition(demande.statut, 'CONVERTI');

      // Conditional update: two simultaneous clicks cannot create two quotes
      const { count } = await tx.demandeDevis.updateMany({
        where: { id, statut: demande.statut },
        data: { statut: 'CONVERTI' },
      });
      if (!count) throw new BusinessException('DEMANDE_MODIFIEE', 'La demande vient d’être modifiée. Rechargez la page.');

      const devis = await this.devis.createDraft(tx, user, {
        clientId: demande.clientId,
        demandeDevisId: demande.id,
        notes: `Demande ${demande.reference} : ${demande.description}`,
      });
      return devis.id;
    });
    return this.devis.findOne(user, devisId);
  }

  /** Only a request that never produced a quote. */
  async remove(user: AuthUser, id: number): Promise<void> {
    const demande = await this.findOne(user, id);
    if (demande.devis.length > 0) {
      throw new BusinessException('DEMANDE_AVEC_DEVIS', 'Cette demande a un devis : marquez-la perdue plutôt.');
    }
    await this.prisma.demandeDevis.delete({ where: { id } });
  }
}
