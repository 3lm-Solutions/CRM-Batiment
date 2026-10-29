import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException } from '../../../common';
import { ChantierStatut, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  assertDateRange,
  chantierProgress,
  normalizeTaskProgress,
} from '../../execution/chantiers/tache-rules';
import type { CreateDisponibiliteDto } from '../../execution/sous-traitants/dto/sous-traitants.dto';
import { PortailEvents, type TacheAvanceeEvent } from '../portails.events';
import { AvancementTacheDto } from './portail-sous-traitant.dto';

const ACTIFS: ChantierStatut[] = ['PLANIFIE', 'EN_COURS', 'SUSPENDU'];
const CLOSED: ChantierStatut[] = ['CLOTURE', 'ANNULE'];

/**
 * The sous-traitant portal. What he sees is decided by ONE rule: the job sites opened to his
 * account (ChantierSousTraitant). Never any price, quote, invoice, client phone or internal note.
 */
@Injectable()
export class PortailSousTraitantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private visible(user: AuthUser): Prisma.ChantierWhereInput {
    return { companyId: user.companyId, sousTraitantsVisibles: { some: { userId: user.id } } };
  }

  // ── availabilities (E7 of 20/10: entered by the sous-traitant himself) ──────

  /** The sous-traitant record linked to this account (a portal account without record has no dossier). */
  private async monDossier(user: AuthUser): Promise<number> {
    const st = await this.prisma.sousTraitant.findFirst({
      where: { userId: user.id, companyId: user.companyId },
      select: { id: true },
    });
    if (!st)
      throw new ForbiddenException(
        'Votre compte n’est pas encore lié à une fiche sous-traitant. Contactez l’entreprise.',
      );
    return st.id;
  }

  /** Current and future periods (the past is not useful to plan). */
  async disponibilites(user: AuthUser) {
    const sousTraitantId = await this.monDossier(user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.disponibiliteSousTraitant.findMany({
      where: { sousTraitantId, dateFin: { gte: today } },
      orderBy: { dateDebut: 'asc' },
      select: { id: true, dateDebut: true, dateFin: true, disponible: true, notes: true },
    });
  }

  async ajouterDisponibilite(user: AuthUser, dto: CreateDisponibiliteDto) {
    const sousTraitantId = await this.monDossier(user);
    assertDateRange(dto.dateDebut, dto.dateFin);
    return this.prisma.disponibiliteSousTraitant.create({
      data: {
        ...dto,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        companyId: user.companyId,
        sousTraitantId,
      },
      select: { id: true, dateDebut: true, dateFin: true, disponible: true, notes: true },
    });
  }

  /** Only one of HIS periods (same 404 for someone else's: nothing to probe). */
  async supprimerDisponibilite(user: AuthUser, id: number): Promise<void> {
    const sousTraitantId = await this.monDossier(user);
    const { count } = await this.prisma.disponibiliteSousTraitant.deleteMany({
      where: { id, sousTraitantId },
    });
    if (!count) throw new NotFoundException(`Disponibilité #${id} introuvable`);
  }

  /** His company record (insurance status, contracts) — his own amounts, nobody else's. */
  async profil(user: AuthUser) {
    const [compte, dossier] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { id: true, nom: true, prenom: true, email: true, telephone: true },
      }),
      this.prisma.sousTraitant.findFirst({
        where: { userId: user.id, companyId: user.companyId },
        select: {
          id: true,
          nom: true,
          specialite: true,
          statut: true,
          assurances: {
            select: {
              id: true,
              typeAssurance: true,
              compagnieAssurance: true,
              dateExpiration: true,
              statut: true,
            },
            orderBy: { dateExpiration: 'asc' },
          },
          contrats: {
            select: {
              id: true,
              reference: true,
              statut: true,
              montantHT: true,
              dateDebut: true,
              dateFin: true,
              chantier: { select: { id: true, reference: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    ]);
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { nom: true, email: true, telephone: true },
    });
    return { compte, dossier, entreprise: company };
  }

  async dashboard(user: AuthUser) {
    const [chantiersActifs, tachesOuvertes, rapportsARevoir, rapportsEnAttente, assurances] =
      await Promise.all([
        this.prisma.chantier.count({ where: { ...this.visible(user), statut: { in: ACTIFS } } }),
        this.prisma.tache.count({
          where: {
            statut: { not: 'TERMINEE' },
            affectations: { some: { userId: user.id } },
            chantier: { ...this.visible(user), statut: { notIn: CLOSED } },
          },
        }),
        this.prisma.rapportChantier.count({ where: { auteurId: user.id, statut: 'REJETE' } }),
        this.prisma.rapportChantier.count({ where: { auteurId: user.id, statut: 'SOUMIS' } }),
        this.prisma.assuranceSousTraitant.findMany({
          where: { sousTraitant: { userId: user.id }, statut: { not: 'VALIDE' } },
          select: { typeAssurance: true, statut: true, dateExpiration: true },
        }),
      ]);
    const prochainesTaches = await this.prisma.tache.findMany({
      where: {
        statut: { not: 'TERMINEE' },
        affectations: { some: { userId: user.id } },
        chantier: { ...this.visible(user), statut: { notIn: CLOSED } },
      },
      select: {
        id: true,
        libelle: true,
        statut: true,
        avancement: true,
        dateFin: true,
        chantier: { select: { id: true, reference: true, adresse: true } },
      },
      orderBy: [{ dateFin: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      take: 8,
    });
    return {
      chantiersActifs,
      tachesOuvertes,
      rapportsARevoir,
      rapportsEnAttente,
      assurancesAlerte: assurances,
      prochainesTaches,
    };
  }

  async chantiers(user: AuthUser) {
    const rows = await this.prisma.chantier.findMany({
      where: this.visible(user),
      orderBy: [{ statut: 'asc' }, { dateDebut: 'desc' }],
      select: {
        id: true,
        reference: true,
        adresse: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
        client: { select: { nom: true } },
        chefChantier: { select: { nom: true, prenom: true, telephone: true } },
        taches: {
          select: {
            avancement: true,
            affectations: { where: { userId: user.id }, select: { id: true } },
          },
        },
      },
    });
    return rows.map(({ taches, ...c }) => ({
      ...c,
      avancement: chantierProgress(taches),
      mesTaches: taches.filter((t) => t.affectations.length).length,
    }));
  }

  async chantier(user: AuthUser, id: number) {
    const c = await this.prisma.chantier.findFirst({
      where: { id, ...this.visible(user) },
      select: {
        id: true,
        reference: true,
        adresse: true,
        description: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
        client: { select: { nom: true } },
        chefChantier: { select: { nom: true, prenom: true, telephone: true, email: true } },
        taches: {
          orderBy: { ordre: 'asc' },
          select: {
            id: true,
            libelle: true,
            description: true,
            statut: true,
            avancement: true,
            dateDebut: true,
            dateFin: true,
            commentaire: true,
            affectations: { select: { userId: true } },
            // Sub-tasks to tick (21/10)
            checklist: {
              orderBy: { ordre: 'asc' },
              select: { id: true, libelle: true, fait: true },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, nom: true, type: true, url: true, fichierId: true, createdAt: true },
        },
      },
    });
    if (!c) throw new NotFoundException(`Chantier #${id} introuvable`);
    const taches = c.taches.map(({ affectations, ...t }) => ({
      ...t,
      affecteeAMoi: affectations.some((a) => a.userId === user.id),
    }));
    return { ...c, taches, avancement: chantierProgress(c.taches) };
  }

  /** Progress on a task assigned to him, on an open job site. Status and progress stay consistent. */
  async avancerTache(user: AuthUser, tacheId: number, dto: AvancementTacheDto) {
    const tache = await this.prisma.tache.findFirst({
      where: {
        id: tacheId,
        affectations: { some: { userId: user.id } },
        chantier: this.visible(user),
      },
      include: {
        chantier: {
          select: {
            id: true,
            reference: true,
            statut: true,
            chefChantierId: true,
            companyId: true,
          },
        },
      },
    });
    if (!tache) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    if (CLOSED.includes(tache.chantier.statut))
      throw new BusinessException('CHANTIER_FERME', 'Ce chantier est clôturé.');

    const next = normalizeTaskProgress(tache, dto);
    // Conditional on the values read: a concurrent edit by the chef is not silently overwritten
    const { count } = await this.prisma.tache.updateMany({
      where: { id: tacheId, statut: tache.statut, avancement: tache.avancement },
      data: { ...next, ...(dto.commentaire !== undefined && { commentaire: dto.commentaire }) },
    });
    if (!count)
      throw new BusinessException('TACHE_MODIFIEE', 'La tâche vient d’être modifiée. Rechargez.');

    if (next.avancement !== tache.avancement) {
      const auteur = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { nom: true, prenom: true },
      });
      const event: TacheAvanceeEvent = {
        companyId: tache.chantier.companyId,
        chantierId: tache.chantier.id,
        chantierReference: tache.chantier.reference,
        chefChantierId: tache.chantier.chefChantierId,
        tacheLibelle: tache.libelle,
        avancement: next.avancement,
        auteurNom: [auteur.prenom, auteur.nom].filter(Boolean).join(' '),
      };
      this.events.emit(PortailEvents.TACHE_AVANCEE, event);
    }
    return this.chantier(user, tache.chantier.id);
  }
}
