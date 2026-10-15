import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, ReferencePrefix, ReferenceService, sumMoney, toDecimal, toSkipTake } from '../../../common';
import { CommandeFournisseurStatut, Prisma, Role, Unite } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { MailService } from '../../core/mail/mail.service';
import { commandeFournisseurMail } from '../../core/mail/templates/finance.templates';
import { StockService } from '../stock/stock.service';
import { CommandeMachine, RECEIVABLE } from './commande-status';
import { QueryCommandesDto, ReceptionDto, UpdateCommandeDto, UpdateLignesCommandeDto } from './commandes.dto';
import { type CatalogueForNeeds, computeMaterialNeeds } from './material-needs';

const INCLUDE = {
  fournisseur: { select: { id: true, nom: true, email: true, telephone: true } },
  devis: { select: { id: true, reference: true, chantierId: true } },
  lignes: { orderBy: { id: 'asc' }, include: { materiau: { select: { id: true, nom: true, stockActuel: true } } } },
  receptions: {
    orderBy: { dateReception: 'desc' },
    include: { lignes: true, user: { select: { id: true, nom: true, prenom: true } } },
  },
} satisfies Prisma.CommandeFournisseurInclude;

@Injectable()
export class CommandesService {
  private readonly logger = new Logger(CommandesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly stock: StockService,
    private readonly mail: MailService,
  ) {}

  // ── P0.4 : generation from an accepted quote ────────────────────────────

  /**
   * Creates one CREEE order per supplier, inside the quote's transaction.
   * Idempotent: a quote that already has orders creates nothing.
   */
  async createFromDevis(tx: DbClient, devis: { id: number; companyId: number; reference: string }) {
    const existing = await tx.commandeFournisseur.count({ where: { devisId: devis.id } });
    if (existing) return { created: 0, sansFournisseur: [] as { materiauId: number; nom: string }[] };

    const lignes = await tx.ligneDevis.findMany({
      where: { devisId: devis.id },
      select: { quantite: true, prestationId: true, materiauId: true, optionsChoisies: true },
    });
    const needLines = lignes.map((l) => ({
      quantite: l.quantite,
      prestationId: l.prestationId,
      materiauId: l.materiauId,
      choixIds: Array.isArray(l.optionsChoisies)
        ? (l.optionsChoisies as { choixId?: number }[]).map((c) => c.choixId).filter((id): id is number => !!id)
        : [],
    }));

    const { parFournisseur, sansFournisseur } = computeMaterialNeeds(needLines, await this.loadCatalogue(tx, needLines));

    const fournisseurs = await tx.fournisseur.findMany({
      where: { id: { in: [...parFournisseur.keys()] } },
      select: { id: true, delaiLivraison: true },
    });
    for (const [fournisseurId, orderLines] of parFournisseur) {
      const delai = fournisseurs.find((f) => f.id === fournisseurId)?.delaiLivraison;
      await tx.commandeFournisseur.create({
        data: {
          companyId: devis.companyId,
          devisId: devis.id,
          fournisseurId,
          reference: await this.references.next(ReferencePrefix.COMMANDE_FOURNISSEUR, devis.companyId, tx),
          dateLivraisonPrevue: delai != null ? new Date(Date.now() + delai * 86_400_000) : null,
          notes: `Généré depuis le devis ${devis.reference}`,
          lignes: { create: orderLines.map((l) => ({ ...l, unite: l.unite as Unite })) },
        },
      });
    }
    if (sansFournisseur.length) {
      this.logger.warn(
        `Devis ${devis.reference} : matériaux sans fournisseur, non commandés : ${sansFournisseur.map((m) => m.nom).join(', ')}`,
      );
    }
    return { created: parFournisseur.size, sansFournisseur };
  }

  // ── read ────────────────────────────────────────────────────────────────

  async findAll(user: AuthUser, query: QueryCommandesDto) {
    // The role scope (e.g. a chef's own job sites) is ANDed with the filters: a filter or a
    // search can narrow it but never replace it (a spread let `chefChantierId: undefined`
    // or a search `OR` silently override the scope).
    const where: Prisma.CommandeFournisseurWhereInput = {
      AND: [
        this.scope(user),
        {
          statutLivraison: query.statuts?.length ? { in: query.statuts } : undefined,
          fournisseurId: query.fournisseurId,
          devisId: query.devisId,
          ...(query.search && { reference: { contains: query.search, mode: 'insensitive' } }),
        },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.commandeFournisseur.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          fournisseur: { select: { id: true, nom: true } },
          devis: { select: { id: true, reference: true } },
          lignes: { select: { totalHT: true } },
        },
        ...toSkipTake(query),
      }),
      this.prisma.commandeFournisseur.count({ where }),
    ]);
    const data = rows.map(({ lignes, ...c }) => ({ ...c, totalHT: sumMoney(lignes.map((l) => l.totalHT)) }));
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const commande = await this.prisma.commandeFournisseur.findFirst({ where: { id, ...this.scope(user) }, include: INCLUDE });
    if (!commande) throw new NotFoundException(`Commande #${id} introuvable`);
    return { ...commande, totalHT: sumMoney(commande.lignes.map((l) => l.totalHT)) };
  }

  // ── write ───────────────────────────────────────────────────────────────

  async update(user: AuthUser, id: number, dto: UpdateCommandeDto) {
    const commande = await this.findOne(user, id);
    if (commande.statutLivraison !== 'CREEE') {
      throw new BusinessException('COMMANDE_ENVOYEE', 'Une commande envoyée ne se modifie plus.');
    }
    await this.prisma.commandeFournisseur.update({ where: { id }, data: dto });
    return this.findOne(user, id);
  }

  /** Adjust quantities before sending (e.g. round up to full bags). */
  async updateLignes(user: AuthUser, id: number, dto: UpdateLignesCommandeDto) {
    const commande = await this.findOne(user, id);
    if (commande.statutLivraison !== 'CREEE') {
      throw new BusinessException('COMMANDE_ENVOYEE', 'Une commande envoyée ne se modifie plus.');
    }
    await this.prisma.$transaction(
      dto.lignes.map((l) => {
        const ligne = commande.lignes.find((x) => x.id === l.ligneId);
        if (!ligne) throw new BusinessException('LIGNE_INTROUVABLE', `Ligne #${l.ligneId} absente de cette commande.`);
        return this.prisma.ligneCommandeFournisseur.update({
          where: { id: l.ligneId },
          data: { quantite: l.quantite, totalHT: toDecimal(ligne.prixUnitaire).times(l.quantite).toDecimalPlaces(2) },
        });
      }),
    );
    return this.findOne(user, id);
  }

  /** CREEE → ENVOYEE and email the supplier. */
  async envoyer(user: AuthUser, id: number) {
    const commande = await this.findOne(user, id);
    if (!commande.fournisseur.email) {
      throw new BusinessException('FOURNISSEUR_SANS_EMAIL', 'Ajoutez un email au fournisseur avant l’envoi.');
    }
    await this.transition(this.prisma, commande, 'ENVOYEE', { dateEnvoi: new Date() });

    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { nom: true } });
    const emailSent = await this.mail.send(
      commande.fournisseur.email,
      commandeFournisseurMail({
        fournisseur: commande.fournisseur.nom,
        entreprise: company.nom,
        reference: commande.reference,
        dateLivraisonPrevue: commande.dateLivraisonPrevue,
        lignes: commande.lignes.map((l) => ({
          materiauNom: l.materiauNom,
          quantite: l.quantite.toString(),
          unite: l.unite,
          prixUnitaire: l.prixUnitaire.toNumber(),
          totalHT: l.totalHT.toNumber(),
        })),
        totalHT: commande.totalHT.toNumber(),
      }),
    );
    return { commande: await this.findOne(user, id), emailSent };
  }

  async changerStatut(user: AuthUser, id: number, to: 'EXPEDIEE' | 'ANNULEE' | 'CLOTUREE') {
    const commande = await this.findOne(user, id);
    if (to === 'ANNULEE' && commande.receptions.length) {
      throw new BusinessException('COMMANDE_RECUE', 'Une commande déjà (partiellement) reçue ne peut pas être annulée.');
    }
    await this.transition(this.prisma, commande, to);
    return this.findOne(user, id);
  }

  /**
   * Records a delivery: per line quantities, stock ENTREE for each material (same transaction),
   * then PARTIELLE or RECUE depending on what remains.
   * v2: the old reception only stored totals and never touched the stock.
   */
  async receptionner(user: AuthUser, id: number, dto: ReceptionDto) {
    await this.prisma.$transaction(async (tx) => {
      const commande = await tx.commandeFournisseur.findFirst({
        where: { id, ...this.scope(user) },
        include: { lignes: true, devis: { select: { chantierId: true } } },
      });
      if (!commande) throw new NotFoundException(`Commande #${id} introuvable`);
      if (!RECEIVABLE.includes(commande.statutLivraison)) {
        throw new BusinessException('COMMANDE_NON_RECEPTIONNABLE', `Une commande ${commande.statutLivraison} ne peut pas être réceptionnée.`);
      }

      const reception = await tx.reception.create({
        data: { commandeFournisseurId: id, userId: user.id, notes: dto.notes },
      });

      for (const item of dto.lignes) {
        const ligne = commande.lignes.find((l) => l.id === item.ligneId);
        if (!ligne) throw new BusinessException('LIGNE_INTROUVABLE', `Ligne #${item.ligneId} absente de cette commande.`);
        const restant = ligne.quantite.minus(ligne.quantiteRecue);
        if (toDecimal(item.quantite).gt(restant)) {
          throw new BusinessException(
            'QUANTITE_EXCESSIVE',
            `« ${ligne.materiauNom} » : ${item.quantite} reçu(s) mais il ne reste que ${restant.toString()} à recevoir.`,
          );
        }
        await tx.receptionLigne.create({ data: { receptionId: reception.id, ligneCommandeId: ligne.id, quantite: item.quantite } });
        await tx.ligneCommandeFournisseur.update({
          where: { id: ligne.id },
          data: { quantiteRecue: { increment: item.quantite } },
        });
        if (ligne.materiauId) {
          await this.stock.move(tx, {
            companyId: user.companyId,
            userId: user.id,
            materiauId: ligne.materiauId,
            type: 'ENTREE',
            quantite: item.quantite,
            motif: `Réception commande ${commande.reference}`,
            reference: commande.reference,
            chantierId: commande.devis.chantierId,
          });
        }
      }

      const lignes = await tx.ligneCommandeFournisseur.findMany({ where: { commandeFournisseurId: id } });
      const complete = lignes.every((l) => l.quantiteRecue.gte(l.quantite));
      const to: CommandeFournisseurStatut = complete ? 'RECUE' : 'PARTIELLE';
      if (to !== commande.statutLivraison) await this.transition(tx, commande, to);
    });
    return this.findOne(user, id);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async transition(
    db: DbClient,
    commande: { id: number; statutLivraison: CommandeFournisseurStatut },
    to: CommandeFournisseurStatut,
    data: Prisma.CommandeFournisseurUpdateManyMutationInput = {},
  ) {
    CommandeMachine.assert(commande.statutLivraison, to);
    const { count } = await db.commandeFournisseur.updateMany({
      where: { id: commande.id, statutLivraison: commande.statutLivraison },
      data: { ...data, statutLivraison: to },
    });
    if (!count) throw new BusinessException('COMMANDE_MODIFIEE', 'La commande vient de changer de statut. Rechargez.');
  }

  /** Chef de chantier: orders for his job sites (to receive deliveries). */
  private scope(user: AuthUser): Prisma.CommandeFournisseurWhereInput {
    return user.role === Role.CHEF_CHANTIER
      ? { companyId: user.companyId, devis: { chantier: { chefChantierId: user.id } } }
      : { companyId: user.companyId };
  }

  private async loadCatalogue(db: DbClient, lines: { prestationId: number | null; materiauId: number | null }[]): Promise<CatalogueForNeeds> {
    const prestationIds = [...new Set(lines.map((l) => l.prestationId).filter((id): id is number => !!id))];
    const prestations = await db.prestation.findMany({
      where: { id: { in: prestationIds } },
      select: {
        id: true,
        compositions: { select: { materiauId: true, quantiteParUnite: true } },
        options: { select: { choix: { select: { id: true, compositions: { select: { materiauId: true, quantiteParUnite: true } } } } } },
      },
    });

    const materiauIds = new Set(lines.map((l) => l.materiauId).filter((id): id is number => !!id));
    for (const p of prestations) {
      p.compositions.forEach((c) => c.materiauId && materiauIds.add(c.materiauId));
      p.options.forEach((o) => o.choix.forEach((ch) => ch.compositions.forEach((c) => c.materiauId && materiauIds.add(c.materiauId))));
    }
    const materiaux = await db.materiau.findMany({
      where: { id: { in: [...materiauIds] } },
      select: { id: true, nom: true, unite: true, prixAchatFixe: true, fournisseurId: true },
    });

    return {
      prestations: new Map(
        prestations.map((p) => [
          p.id,
          { base: p.compositions, parChoix: new Map(p.options.flatMap((o) => o.choix.map((ch) => [ch.id, ch.compositions] as const))) },
        ]),
      ),
      materiaux: new Map(materiaux.map((m) => [m.id, m])),
    };
  }
}
