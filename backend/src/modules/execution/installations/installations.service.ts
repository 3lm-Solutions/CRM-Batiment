import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AuthUser,
  BusinessException,
  paginate,
  ReferencePrefix,
  ReferenceService,
} from '../../../common';
import {
  type CommandeFournisseurStatut,
  type InstallationEtape,
  Prisma,
  type SavTicketCategorie,
  type SignalementType,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { FICHIER_SELECT, FichiersService } from '../../core/storage/fichiers.service';
import { SavEvents } from '../../pilotage/sav/sav.events';
import { InstallationPvService, nouveauCodePv } from './installation-pv.service';
import { alertesInstallation, ETAPE_LABEL, ETAPES } from './installation-rules';
import type {
  AttribuerDto,
  ModifierInstallationDto,
  QueryInstallationsDto,
} from './installations.dto';
import {
  INSTALLATION_EVENEMENT,
  type InstallationEvenementType,
  type InstallationEvent,
} from './installations.events';

const PERSONNE = { select: { id: true, nom: true, prenom: true } } as const;

/** What both sides see of an installation (no price anywhere). */
export const INSTALLATION_INCLUDE = {
  chantier: {
    select: {
      id: true,
      reference: true,
      adresse: true,
      statut: true,
      modeInstallation: true,
      client: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          contactNom: true,
          telephone: true,
          email: true,
        },
      },
    },
  },
  devis: {
    select: {
      id: true,
      reference: true,
      lignes: {
        orderBy: { ordre: 'asc' },
        select: {
          id: true,
          description: true,
          quantite: true,
          unite: true,
          prestation: { select: { nom: true } },
        },
      },
    },
  },
  sousTraitant: { select: { id: true, nom: true, telephone: true, email: true, userId: true } },
} satisfies Prisma.InstallationInclude;

const DETAIL_INCLUDE = {
  ...INSTALLATION_INCLUDE,
  evenements: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { user: PERSONNE } },
  signalements: {
    orderBy: { createdAt: 'desc' },
    include: {
      auteur: PERSONNE,
      photos: { select: FICHIER_SELECT },
      savTicket: { select: { id: true, reference: true, statut: true } },
    },
  },
  photos: { select: { ...FICHIER_SELECT, installationEtape: true }, orderBy: { id: 'asc' } },
  pvFichier: { select: FICHIER_SELECT },
} satisfies Prisma.InstallationInclude;

type CommandeLivraison = {
  id: number;
  reference: string;
  statutLivraison: CommandeFournisseurStatut;
  dateLivraisonPrevue: Date | null;
  chantierId: number | null;
  devis: { chantierId: number | null } | null;
  fournisseur: { nom: string };
  lignes: {
    id: number;
    materiauNom: string;
    quantite: Prisma.Decimal;
    quantiteRecue: Prisma.Decimal;
    unite: string;
  }[];
};

const CATEGORIE_SAV: Record<SignalementType, SavTicketCategorie> = {
  RESERVE: 'DEFAUT_TRAVAUX',
  RETARD: 'RETARD',
  INCIDENT: 'SAV_TECHNIQUE',
};
export const SIGNALEMENT_LABEL: Record<SignalementType, string> = {
  RESERVE: 'Réserve',
  RETARD: 'Retard',
  INCIDENT: 'Incident',
};

const fr = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

/**
 * 18/11 (mobile lot B): delegated installations — the office side (ADMIN, ASSISTANTE) and the
 * shared rules (transitions, chronology, events) used by the installer side too.
 */
@Injectable()
export class InstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly fichiers: FichiersService,
    private readonly pv: InstallationPvService,
    private readonly events: EventEmitter2,
  ) {}

  // ── création ────────────────────────────────────────────────────────────

  /**
   * Called inside the transaction of the quote signature (REGIE job site) or by the office
   * (LES_DEUX). Idempotent: a job site has at most one installation.
   */
  async creerPourChantier(
    tx: DbClient,
    chantier: { id: number; companyId: number },
    devisId: number | null,
    userId: number | null,
  ): Promise<{ id: number; reference: string; creee: boolean }> {
    const existante = await tx.installation.findUnique({
      where: { chantierId: chantier.id },
      select: { id: true, reference: true },
    });
    if (existante) return { ...existante, creee: false };
    const reference = await this.references.next(
      ReferencePrefix.INSTALLATION,
      chantier.companyId,
      tx,
    );
    const created = await tx.installation.create({
      data: {
        companyId: chantier.companyId,
        chantierId: chantier.id,
        devisId,
        reference,
        codePv: nouveauCodePv(),
        evenements: {
          create: {
            type: 'CREEE',
            message: userId ? 'Pose déléguée par le bureau.' : 'Devis signé : pose à déléguer.',
            userId,
          },
        },
      },
      select: { id: true, reference: true },
    });
    return { ...created, creee: true };
  }

  /** « Déléguer la pose » of a job site (mode LES_DEUX, or REGIE created before lot B). */
  async creer(user: AuthUser, chantierId: number) {
    const chantier = await this.prisma.chantier.findFirst({
      where: { id: chantierId, companyId: user.companyId },
      select: { id: true, companyId: true, statut: true, devis: { select: { id: true }, take: 1 } },
    });
    if (!chantier) throw new NotFoundException(`Chantier #${chantierId} introuvable`);
    if (['TERMINE', 'CLOTURE', 'ANNULE'].includes(chantier.statut)) {
      throw new BusinessException(
        'CHANTIER_TERMINE',
        'Ce chantier est terminé ou annulé : la pose ne peut plus être déléguée.',
      );
    }
    const res = await this.prisma.$transaction((tx) =>
      this.creerPourChantier(tx, chantier, chantier.devis[0]?.id ?? null, user.id),
    );
    if (!res.creee) {
      throw new BusinessException(
        'INSTALLATION_EXISTANTE',
        `La pose de ce chantier est déjà déléguée (${res.reference}).`,
        409,
        { installationId: res.id },
      );
    }
    return this.detail(user, res.id);
  }

  // ── lecture (bureau) ────────────────────────────────────────────────────

  async liste(user: AuthUser, query: QueryInstallationsDto) {
    const where: Prisma.InstallationWhereInput = {
      companyId: user.companyId,
      ...(query.etape && { etape: query.etape }),
      ...(query.search && {
        OR: [
          { reference: { contains: query.search, mode: 'insensitive' } },
          { chantier: { reference: { contains: query.search, mode: 'insensitive' } } },
          { chantier: { client: { nom: { contains: query.search, mode: 'insensitive' } } } },
          { sousTraitant: { nom: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const rows = await this.prisma.installation.findMany({
      where,
      include: INSTALLATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    let items = await this.avecAlertes(user.companyId, rows);
    if (query.enRetard !== undefined) items = items.filter((i) => i.enRetard === query.enRetard);
    if (query.alerteLivraison !== undefined)
      items = items.filter((i) => i.alerteLivraison === query.alerteLivraison);
    // late ones and delivery alerts first, then by step
    items.sort(
      (a, b) =>
        Number(b.enRetard) - Number(a.enRetard) ||
        Number(b.alerteLivraison) - Number(a.alerteLivraison) ||
        ETAPES.indexOf(a.etape) - ETAPES.indexOf(b.etape),
    );
    const start = (query.page - 1) * query.limit;
    return paginate(items.slice(start, start + query.limit), items.length, query);
  }

  /** Per step, plus the late ones and the delivery alerts (cards of the office screen). */
  async compteurs(user: AuthUser) {
    const rows = await this.prisma.installation.findMany({
      where: { companyId: user.companyId },
      include: INSTALLATION_INCLUDE,
    });
    const items = await this.avecAlertes(user.companyId, rows);
    const parEtape = Object.fromEntries(ETAPES.map((e) => [e, 0])) as Record<
      InstallationEtape,
      number
    >;
    for (const i of items) parEtape[i.etape]++;
    return {
      parEtape,
      enRetard: items.filter((i) => i.enRetard).length,
      alerteLivraison: items.filter((i) => i.alerteLivraison).length,
      pvAVerifier: items.filter((i) => i.pvAVerifier).length,
      signalementsOuverts: await this.prisma.signalement.count({
        where: { statut: 'OUVERT', installation: { companyId: user.companyId } },
      }),
    };
  }

  /** Installers to choose from: active, with an account, their average mark and current missions. */
  async installateurs(user: AuthUser) {
    const rows = await this.prisma.sousTraitant.findMany({
      where: { companyId: user.companyId, installateur: true, statut: 'ACTIF' },
      select: {
        id: true,
        nom: true,
        specialite: true,
        telephone: true,
        userId: true,
        notations: { select: { noteGlobale: true } },
        installations: {
          where: {
            etape: {
              in: ['INSTALLATEUR_PROPOSE', 'MISSION_ACCEPTEE', 'LIVRAISON', 'POSE', 'FINITIONS'],
            },
          },
          select: { id: true },
        },
      },
      orderBy: { nom: 'asc' },
    });
    return rows.map(({ notations, installations, userId, ...st }) => {
      const notes = notations.map((n) => Number(n.noteGlobale)).filter((n) => !Number.isNaN(n));
      return {
        ...st,
        aUnCompte: userId !== null,
        noteMoyenne: notes.length
          ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
          : null,
        nbNotes: notes.length,
        missionsEnCours: installations.length,
      };
    });
  }

  async detail(user: AuthUser, id: number) {
    const row = await this.prisma.installation.findFirst({
      where: { id, companyId: user.companyId },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Installation #${id} introuvable`);
    const [avec] = await this.avecAlertes(user.companyId, [row]);
    return avec;
  }

  // ── actions du bureau ───────────────────────────────────────────────────

  async attribuer(user: AuthUser, id: number, dto: AttribuerDto) {
    const st = await this.prisma.sousTraitant.findFirst({
      where: { id: dto.sousTraitantId, companyId: user.companyId },
      select: { id: true, nom: true, installateur: true, statut: true, userId: true },
    });
    if (!st) throw new NotFoundException(`Sous-traitant #${dto.sousTraitantId} introuvable`);
    if (!st.installateur || st.statut !== 'ACTIF') {
      throw new BusinessException(
        'PAS_INSTALLATEUR',
        `${st.nom} n’est pas un installateur actif (cochez « installateur » sur sa fiche).`,
      );
    }
    if (!st.userId) {
      throw new BusinessException(
        'INSTALLATEUR_SANS_COMPTE',
        `${st.nom} n’a pas de compte : donnez-lui un accès à l’application d’abord.`,
      );
    }
    const dateSouhaitee = dto.dateSouhaitee ? new Date(dto.dateSouhaitee) : undefined;
    return this.agir(user, id, ['DEVIS_SIGNE', 'INSTALLATEUR_PROPOSE'], {
      etape: 'INSTALLATEUR_PROPOSE',
      data: {
        sousTraitantId: st.id,
        noteAttribution: dto.note ?? null,
        ...(dateSouhaitee && { dateSouhaitee }),
        dateProposee: null,
        dateConfirmee: null,
      },
      type: 'PROPOSEE',
      message: `Mission proposée à ${st.nom}${dateSouhaitee ? ` pour le ${fr(dateSouhaitee)}` : ''}.`,
      pour: 'INSTALLATEUR',
      installateurUserId: st.userId,
    });
  }

  async relancer(user: AuthUser, id: number) {
    const i = await this.charger(user.companyId, id);
    if (!i.sousTraitant?.userId || ['TERMINEE', 'CLOTUREE', 'DEVIS_SIGNE'].includes(i.etape)) {
      throw new BusinessException('RELANCE_IMPOSSIBLE', 'Il n’y a pas d’installateur à relancer.');
    }
    if (i.relanceLe && Date.now() - i.relanceLe.getTime() < 60 * 60 * 1000) {
      throw new BusinessException(
        'RELANCE_TROP_TOT',
        'L’installateur a déjà été relancé il y a moins d’une heure.',
      );
    }
    return this.agir(user, id, [i.etape], {
      data: { relanceLe: new Date() },
      type: 'RELANCEE',
      message:
        i.etape === 'INSTALLATEUR_PROPOSE'
          ? 'Relance : merci de répondre à la mission proposée.'
          : 'Relance du bureau sur cette mission.',
      pour: 'INSTALLATEUR',
      installateurUserId: i.sousTraitant.userId,
    });
  }

  async modifier(user: AuthUser, id: number, dto: ModifierInstallationDto) {
    const i = await this.charger(user.companyId, id);
    if (['TERMINEE', 'CLOTUREE'].includes(i.etape)) {
      throw new BusinessException('INSTALLATION_TERMINEE', 'Cette installation est terminée.');
    }
    const dateSouhaitee = dto.dateSouhaitee ? new Date(dto.dateSouhaitee) : undefined;
    return this.agir(user, id, [i.etape], {
      data: {
        ...(dateSouhaitee && { dateSouhaitee }),
        ...(dto.note !== undefined && { noteAttribution: dto.note }),
      },
      type: 'DATE_MODIFIEE',
      message: dateSouhaitee
        ? `Date souhaitée changée : ${fr(dateSouhaitee)}.`
        : 'Note de la mission mise à jour.',
      pour: i.sousTraitant?.userId ? 'INSTALLATEUR' : 'PERSONNE',
      installateurUserId: i.sousTraitant?.userId ?? null,
    });
  }

  /** The office accepts the date proposed by the installer: confirmed, delivery step. */
  async accepterDate(user: AuthUser, id: number) {
    const i = await this.charger(user.companyId, id);
    if (!i.dateProposee) {
      throw new BusinessException(
        'PAS_DE_DATE_PROPOSEE',
        'L’installateur n’a pas proposé de date.',
      );
    }
    return this.agir(user, id, ['MISSION_ACCEPTEE', 'LIVRAISON'], {
      etape: 'LIVRAISON',
      data: { dateConfirmee: i.dateProposee, dateProposee: null },
      type: 'DATE_CONFIRMEE',
      message: `Date d’installation confirmée par le bureau : ${fr(i.dateProposee)}.`,
      pour: 'INSTALLATEUR',
      installateurUserId: i.sousTraitant?.userId ?? null,
    });
  }

  async validerPv(user: AuthUser, id: number) {
    const i = await this.charger(user.companyId, id);
    if (!i.pvAVerifier) {
      throw new BusinessException('PV_NON_A_VERIFIER', 'Aucun PV n’attend de vérification.');
    }
    return this.agir(user, id, ['FINITIONS'], {
      etape: 'TERMINEE',
      data: { pvAVerifier: false, pvSigneLe: new Date() },
      where: { pvAVerifier: true },
      type: 'PV_SIGNE',
      message: 'PV vérifié par le bureau : installation terminée.',
      pour: 'INSTALLATEUR',
      installateurUserId: i.sousTraitant?.userId ?? null,
    });
  }

  async rejeterPv(user: AuthUser, id: number, motif: string) {
    const i = await this.charger(user.companyId, id);
    if (!i.pvAVerifier || !i.pvFichierId) {
      throw new BusinessException('PV_NON_A_VERIFIER', 'Aucun PV n’attend de vérification.');
    }
    const fichierId = i.pvFichierId;
    const res = await this.agir(user, id, ['FINITIONS'], {
      data: { pvAVerifier: false, pvFichierId: null },
      where: { pvAVerifier: true },
      type: 'PV_REJETE',
      message: `PV refusé par le bureau : ${motif}`,
      pour: 'INSTALLATEUR',
      installateurUserId: i.sousTraitant?.userId ?? null,
      alerte: true,
    });
    await this.fichiers.remove(fichierId);
    return res;
  }

  async cloturer(user: AuthUser, id: number) {
    const i = await this.charger(user.companyId, id);
    return this.agir(user, id, ['TERMINEE'], {
      etape: 'CLOTUREE',
      data: { clotureLe: new Date() },
      type: 'CLOTUREE',
      message: 'Installation clôturée par le bureau.',
      pour: i.sousTraitant?.userId ? 'INSTALLATEUR' : 'PERSONNE',
      installateurUserId: i.sousTraitant?.userId ?? null,
    });
  }

  /** Only before the installer accepted (e.g. LES_DEUX: the team finally does the pose). */
  async supprimer(user: AuthUser, id: number): Promise<void> {
    const i = await this.prisma.installation.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, etape: true },
    });
    if (!i) throw new NotFoundException(`Installation #${id} introuvable`);
    if (!['DEVIS_SIGNE', 'INSTALLATEUR_PROPOSE'].includes(i.etape)) {
      throw new BusinessException(
        'INSTALLATION_EN_COURS',
        'La mission est déjà acceptée : elle ne peut plus être supprimée.',
      );
    }
    const { count } = await this.prisma.installation.deleteMany({
      where: { id, etape: { in: ['DEVIS_SIGNE', 'INSTALLATEUR_PROPOSE'] } },
    });
    if (!count) throw this.modifiee();
  }

  async traiterSignalement(user: AuthUser, id: number, signalementId: number) {
    const s = await this.signalement(user, id, signalementId);
    if (s.statut === 'TRAITE') {
      throw new BusinessException('SIGNALEMENT_DEJA_TRAITE', 'Ce signalement est déjà traité.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.signalement.update({
        where: { id: signalementId },
        data: { statut: 'TRAITE', traiteLe: new Date() },
      });
      await tx.installationEvenement.create({
        data: {
          installationId: id,
          type: 'SIGNALEMENT_TRAITE',
          message: `${SIGNALEMENT_LABEL[s.type]} traité(e) par le bureau.`,
          userId: user.id,
        },
      });
    });
    this.emettre(
      user,
      s.installation,
      'SIGNALEMENT_TRAITE',
      `${SIGNALEMENT_LABEL[s.type]} traité(e) par le bureau.`,
      'INSTALLATEUR',
    );
    return this.detail(user, id);
  }

  /** A report becomes an after-sales ticket of the job site (allowed during the works). */
  async creerSav(user: AuthUser, id: number, signalementId: number) {
    const s = await this.signalement(user, id, signalementId);
    if (s.savTicketId) {
      throw new BusinessException(
        'SAV_DEJA_CREE',
        'Un ticket SAV existe déjà pour ce signalement.',
        409,
        {
          savTicketId: s.savTicketId,
        },
      );
    }
    const chantier = s.installation.chantier;
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.savTicket.create({
        data: {
          companyId: user.companyId,
          clientId: chantier.clientId,
          chantierId: chantier.id,
          devisId: s.installation.devisId,
          createurId: user.id,
          reference: await this.references.next(ReferencePrefix.SAV, user.companyId, tx),
          titre: `${SIGNALEMENT_LABEL[s.type]} — installation ${s.installation.reference}`,
          description: s.description,
          categorie: CATEGORIE_SAV[s.type],
          priorite: s.type === 'INCIDENT' ? 'HAUTE' : 'NORMALE',
        },
      });
      await tx.savTicketHistorique.create({
        data: { ticketId: created.id, statut: 'OUVERT', userId: user.id },
      });
      await tx.savTicketNote.create({
        data: {
          ticketId: created.id,
          userId: user.id,
          contenu: `Ouvert depuis un signalement de l’installateur (${s.installation.reference}).`,
        },
      });
      await tx.signalement.update({
        where: { id: signalementId },
        data: { savTicketId: created.id },
      });
      await tx.installationEvenement.create({
        data: {
          installationId: id,
          type: 'SAV_CREE',
          message: `Ticket SAV ${created.reference} ouvert depuis le signalement.`,
          userId: user.id,
        },
      });
      return created;
    });
    this.events.emit(SavEvents.CREE, {
      companyId: ticket.companyId,
      ticketId: ticket.id,
      reference: ticket.reference,
      titre: ticket.titre,
      priorite: ticket.priorite,
      assignedToId: ticket.assignedToId,
    });
    this.emettre(
      user,
      s.installation,
      'SAV_CREE',
      `Ticket SAV ${ticket.reference} ouvert depuis votre signalement.`,
      'INSTALLATEUR',
    );
    return { savTicketId: ticket.id, reference: ticket.reference };
  }

  pdfPv(user: AuthUser, id: number): Promise<Buffer> {
    return this.pv.generer(user.companyId, id);
  }

  // ── règles partagées avec le côté installateur ──────────────────────────

  async charger(companyId: number, id: number, where: Prisma.InstallationWhereInput = {}) {
    const i = await this.prisma.installation.findFirst({
      where: { id, companyId, ...where },
      include: { sousTraitant: { select: { id: true, nom: true, userId: true } } },
    });
    if (!i) throw new NotFoundException(`Installation #${id} introuvable`);
    return i;
  }

  /**
   * One action: conditional update on the current step (a race → 409), one chronology line in
   * the same transaction, then the event after the commit.
   */
  async agir(
    user: AuthUser,
    id: number,
    depuis: InstallationEtape[],
    a: {
      etape?: InstallationEtape;
      data?: Prisma.InstallationUncheckedUpdateManyInput;
      where?: Prisma.InstallationWhereInput;
      type: InstallationEvenementType;
      message: string;
      pour: InstallationEvent['pour'];
      installateurUserId: number | null;
      alerte?: boolean;
    },
    db?: DbClient,
  ) {
    const i = await this.charger(user.companyId, id);
    if (!depuis.includes(i.etape)) {
      throw new BusinessException(
        'ETAPE_INVALIDE',
        `Impossible à l’étape « ${ETAPE_LABEL[i.etape]} ».`,
        422,
        { etape: i.etape },
      );
    }
    const run = async (tx: DbClient) => {
      const { count } = await tx.installation.updateMany({
        where: { id, etape: i.etape, ...(a.where as Prisma.InstallationWhereInput) },
        data: { ...a.data, ...(a.etape && { etape: a.etape }) },
      });
      if (!count) throw this.modifiee();
      await tx.installationEvenement.create({
        data: { installationId: id, type: a.type, message: a.message, userId: user.id },
      });
    };
    if (db) await run(db);
    else await this.prisma.$transaction((tx) => run(tx));
    this.events.emit(INSTALLATION_EVENEMENT, {
      companyId: user.companyId,
      installationId: id,
      reference: i.reference,
      type: a.type,
      message: a.message,
      userId: user.id,
      installateurUserId: a.installateurUserId,
      pour: a.pour,
      alerte: a.alerte,
    } satisfies InstallationEvent);
    return i;
  }

  emettre(
    user: AuthUser,
    i: { id: number; reference: string; sousTraitant?: { userId: number | null } | null },
    type: InstallationEvenementType,
    message: string,
    pour: InstallationEvent['pour'],
    alerte = false,
  ) {
    this.events.emit(INSTALLATION_EVENEMENT, {
      companyId: user.companyId,
      installationId: i.id,
      reference: i.reference,
      type,
      message,
      userId: user.id,
      installateurUserId: i.sousTraitant?.userId ?? null,
      pour,
      alerte,
    } satisfies InstallationEvent);
  }

  modifiee() {
    return new BusinessException(
      'INSTALLATION_MODIFIEE',
      'Cette installation vient de changer. Rechargez.',
      409,
    );
  }

  /** Orders of these job sites (manual or from the quote), without any price. */
  async livraisons(companyId: number, chantierIds: number[]): Promise<CommandeLivraison[]> {
    if (!chantierIds.length) return [];
    return this.prisma.commandeFournisseur.findMany({
      where: {
        companyId,
        OR: [{ chantierId: { in: chantierIds } }, { devis: { chantierId: { in: chantierIds } } }],
      },
      select: {
        id: true,
        reference: true,
        statutLivraison: true,
        dateLivraisonPrevue: true,
        chantierId: true,
        devis: { select: { chantierId: true } },
        fournisseur: { select: { nom: true } },
        lignes: {
          select: { id: true, materiauNom: true, quantite: true, quantiteRecue: true, unite: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /** Adds `enRetard`, `alerteLivraison` and the deliveries of the job site to each installation. */
  async avecAlertes<
    T extends {
      chantierId: number;
      etape: InstallationEtape;
      dateConfirmee: Date | null;
      dateSouhaitee: Date | null;
    },
  >(companyId: number, rows: T[]) {
    const commandes = await this.livraisons(
      companyId,
      rows.map((r) => r.chantierId),
    );
    const now = new Date();
    return rows.map((r) => {
      const leurs = commandes.filter(
        (c) => c.chantierId === r.chantierId || c.devis?.chantierId === r.chantierId,
      );
      const livraisons = leurs.map(({ devis: _d, chantierId: _c, ...c }) => c);
      return { ...r, ...alertesInstallation(r, leurs, now), livraisons };
    });
  }

  private async signalement(user: AuthUser, id: number, signalementId: number) {
    const s = await this.prisma.signalement.findFirst({
      where: { id: signalementId, installationId: id, installation: { companyId: user.companyId } },
      include: {
        installation: {
          select: {
            id: true,
            reference: true,
            devisId: true,
            chantier: { select: { id: true, clientId: true } },
            sousTraitant: { select: { userId: true } },
          },
        },
      },
    });
    if (!s) throw new NotFoundException(`Signalement #${signalementId} introuvable`);
    return s;
  }
}
