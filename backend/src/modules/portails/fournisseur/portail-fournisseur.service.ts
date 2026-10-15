import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, paginate, sumMoney, toSkipTake } from '../../../common';
import { CommandeFournisseurStatut, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommandeMachine } from '../../finance/commandes-fournisseur/commande-status';
import { PortailEvents, type CommandePortailEvent } from '../portails.events';
import { QueryCommandesPortailDto, ReponseFournisseurDto } from './portail-fournisseur.dto';

/** A draft (CREEE) has not been sent: the supplier must not see it yet. */
const VISIBLE: CommandeFournisseurStatut[] = ['ENVOYEE', 'EXPEDIEE', 'PARTIELLE', 'RECUE', 'CLOTUREE', 'ANNULEE'];

/**
 * Supplier portal. The account is tied to ONE supplier record by Fournisseur.userId
 * (the old portal matched suppliers by email — any account with the same email saw the orders).
 * A supplier sees his own orders and his own prices; nothing about the client's quote.
 */
@Injectable()
export class PortailFournisseurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private async fournisseur(user: AuthUser) {
    const f = await this.prisma.fournisseur.findFirst({
      where: { userId: user.id, companyId: user.companyId },
      select: { id: true, nom: true, contact: true, email: true, telephone: true, adresse: true, delaiLivraison: true, actif: true },
    });
    if (!f) throw new ForbiddenException('Ce compte n’est rattaché à aucun fournisseur. Contactez l’entreprise.');
    return f;
  }

  async profil(user: AuthUser) {
    const [fournisseur, entreprise] = await Promise.all([
      this.fournisseur(user),
      this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId }, select: { nom: true, email: true, telephone: true, adresse: true } }),
    ]);
    return { fournisseur, entreprise };
  }

  async dashboard(user: AuthUser) {
    const f = await this.fournisseur(user);
    const grouped = await this.prisma.commandeFournisseur.groupBy({
      by: ['statutLivraison'],
      where: { fournisseurId: f.id, statutLivraison: { in: VISIBLE } },
      _count: { _all: true },
    });
    const count = (s: CommandeFournisseurStatut[]) => grouped.filter((g) => s.includes(g.statutLivraison)).reduce((n, g) => n + g._count._all, 0);
    const aAccuser = await this.prisma.commandeFournisseur.count({ where: { fournisseurId: f.id, statutLivraison: 'ENVOYEE', dateAccuseReception: null } });
    return {
      fournisseur: f,
      aAccuser,
      aExpedier: count(['ENVOYEE']),
      enLivraison: count(['EXPEDIEE', 'PARTIELLE']),
      livrees: count(['RECUE', 'CLOTUREE']),
    };
  }

  async commandes(user: AuthUser, query: QueryCommandesPortailDto) {
    const f = await this.fournisseur(user);
    const statuts = query.statuts?.length ? query.statuts.filter((s) => VISIBLE.includes(s)) : VISIBLE;
    const where: Prisma.CommandeFournisseurWhereInput = {
      fournisseurId: f.id,
      statutLivraison: { in: statuts },
      ...(query.search && { reference: { contains: query.search, mode: 'insensitive' } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.commandeFournisseur.findMany({
        where,
        orderBy: { dateEnvoi: 'desc' },
        select: {
          id: true,
          reference: true,
          statutLivraison: true,
          dateEnvoi: true,
          dateLivraisonPrevue: true,
          dateAccuseReception: true,
          lignes: { select: { totalHT: true } },
        },
        ...toSkipTake(query),
      }),
      this.prisma.commandeFournisseur.count({ where }),
    ]);
    return paginate(
      rows.map(({ lignes, ...c }) => ({ ...c, nombreLignes: lignes.length, totalHT: sumMoney(lignes.map((l) => l.totalHT)) })),
      total,
      query,
    );
  }

  async commande(user: AuthUser, id: number) {
    const f = await this.fournisseur(user);
    const c = await this.prisma.commandeFournisseur.findFirst({
      where: { id, fournisseurId: f.id, statutLivraison: { in: VISIBLE } },
      select: {
        id: true,
        reference: true,
        statutLivraison: true,
        date: true,
        dateEnvoi: true,
        dateLivraisonPrevue: true,
        dateAccuseReception: true,
        commentaireFournisseur: true,
        notes: true,
        lignes: {
          orderBy: { id: 'asc' },
          select: { id: true, materiauNom: true, quantite: true, quantiteRecue: true, unite: true, prixUnitaire: true, totalHT: true },
        },
        // Delivery address only — no client name, no quote amounts
        devis: { select: { chantier: { select: { adresse: true } }, client: { select: { adresseChantier: true, adresseClient: true } } } },
      },
    });
    if (!c) throw new NotFoundException(`Commande #${id} introuvable`);
    const { devis, ...rest } = c;
    return {
      ...rest,
      adresseLivraison: devis.chantier?.adresse ?? devis.client.adresseChantier ?? devis.client.adresseClient ?? null,
      totalHT: sumMoney(c.lignes.map((l) => l.totalHT)),
    };
  }

  /** "Bien reçue": the supplier confirms the order and may announce a delivery date. */
  async accuserReception(user: AuthUser, id: number, dto: ReponseFournisseurDto) {
    const f = await this.fournisseur(user);
    const c = await this.findOwn(f.id, id);
    if (c.statutLivraison !== 'ENVOYEE') throw new BusinessException('COMMANDE_DEJA_TRAITEE', 'Cette commande n’attend plus d’accusé de réception.');
    await this.prisma.commandeFournisseur.update({
      where: { id },
      data: {
        dateAccuseReception: c.dateAccuseReception ?? new Date(),
        ...(dto.dateLivraisonPrevue && { dateLivraisonPrevue: new Date(dto.dateLivraisonPrevue) }),
        ...(dto.commentaire !== undefined && { commentaireFournisseur: dto.commentaire }),
      },
    });
    const updated = await this.commande(user, id);
    this.emit(PortailEvents.COMMANDE_ACCUSEE, user.companyId, updated.id, updated.reference, f.nom, updated.dateLivraisonPrevue);
    return updated;
  }

  /** Shipping notice: ENVOYEE → EXPEDIEE (same state machine as the office side). */
  async expedier(user: AuthUser, id: number, dto: ReponseFournisseurDto) {
    const f = await this.fournisseur(user);
    const c = await this.findOwn(f.id, id);
    CommandeMachine.assert(c.statutLivraison, 'EXPEDIEE');
    const { count } = await this.prisma.commandeFournisseur.updateMany({
      where: { id, statutLivraison: c.statutLivraison },
      data: {
        statutLivraison: 'EXPEDIEE',
        dateAccuseReception: c.dateAccuseReception ?? new Date(),
        ...(dto.dateLivraisonPrevue && { dateLivraisonPrevue: new Date(dto.dateLivraisonPrevue) }),
        ...(dto.commentaire !== undefined && { commentaireFournisseur: dto.commentaire }),
      },
    });
    if (!count) throw new BusinessException('COMMANDE_MODIFIEE', 'La commande vient de changer de statut. Rechargez.');
    const updated = await this.commande(user, id);
    this.emit(PortailEvents.COMMANDE_EXPEDIEE, user.companyId, updated.id, updated.reference, f.nom, updated.dateLivraisonPrevue);
    return updated;
  }

  private async findOwn(fournisseurId: number, id: number) {
    const c = await this.prisma.commandeFournisseur.findFirst({
      where: { id, fournisseurId, statutLivraison: { in: VISIBLE } },
      select: { id: true, statutLivraison: true, dateAccuseReception: true },
    });
    if (!c) throw new NotFoundException(`Commande #${id} introuvable`);
    return c;
  }

  private emit(name: string, companyId: number, commandeId: number, reference: string, fournisseurNom: string, dateLivraisonPrevue: Date | null) {
    const event: CommandePortailEvent = { companyId, commandeId, reference, fournisseurNom, dateLivraisonPrevue };
    this.events.emit(name, event);
  }
}
