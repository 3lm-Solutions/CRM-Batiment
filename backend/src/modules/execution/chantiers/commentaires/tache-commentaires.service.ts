import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../../../../common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ChantiersService } from '../chantiers.service';
import { TacheEvents, type TacheCommenteeEvent } from '../taches.events';

const COMMENTAIRE_SELECT = {
  id: true,
  texte: true,
  createdAt: true,
  auteur: { select: { id: true, nom: true, prenom: true, role: true } },
} satisfies Prisma.TacheCommentaireSelect;

/**
 * Comment thread of a task (16/11, mobile lot B1) — the web keeps its single « note »
 * (Tache.commentaire); this thread is new and does not replace it.
 *  - office / chef: tasks of the job sites they can see (same scope as the tasks themselves);
 *  - sous-traitant (portal): only the tasks assigned to him.
 */
@Injectable()
export class TacheCommentairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chantiers: ChantiersService,
    private readonly events: EventEmitter2,
  ) {}

  async list(user: AuthUser, chantierId: number, tacheId: number) {
    await this.chantiers.assertAccess(user, chantierId);
    await this.tache(chantierId, tacheId);
    return this.lire(tacheId);
  }

  async ajouter(user: AuthUser, chantierId: number, tacheId: number, texte: string) {
    await this.chantiers.assertAccess(user, chantierId);
    const tache = await this.tache(chantierId, tacheId);
    return this.creer(user, tache, texte);
  }

  // ── sous-traitant portal ────────────────────────────────────────────────

  async listPortail(user: AuthUser, tacheId: number) {
    await this.tacheAffectee(user, tacheId);
    return this.lire(tacheId);
  }

  async ajouterPortail(user: AuthUser, tacheId: number, texte: string) {
    const tache = await this.tacheAffectee(user, tacheId);
    return this.creer(user, tache, texte);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private lire(tacheId: number) {
    return this.prisma.tacheCommentaire.findMany({
      where: { tacheId },
      orderBy: { createdAt: 'asc' },
      select: COMMENTAIRE_SELECT,
    });
  }

  private async creer(user: AuthUser, tache: TacheContexte, texte: string) {
    const commentaire = await this.prisma.tacheCommentaire.create({
      data: { tacheId: tache.id, auteurId: user.id, texte },
      select: COMMENTAIRE_SELECT,
    });
    const destinataires = [
      ...tache.affectations.map((a) => a.userId),
      tache.chantier.chefChantierId,
    ].filter((id): id is number => typeof id === 'number' && id !== user.id);
    this.events.emit(TacheEvents.COMMENTEE, {
      companyId: tache.chantier.companyId,
      chantierId: tache.chantierId,
      chantierReference: tache.chantier.reference,
      tacheId: tache.id,
      tacheLibelle: tache.libelle,
      auteurId: user.id,
      auteurNom: `${commentaire.auteur?.prenom ?? ''} ${commentaire.auteur?.nom ?? ''}`.trim(),
      extrait: texte.length > 120 ? `${texte.slice(0, 117)}...` : texte,
      destinataires: [...new Set(destinataires)],
    } satisfies TacheCommenteeEvent);
    return commentaire;
  }

  private async tache(chantierId: number, tacheId: number): Promise<TacheContexte> {
    const tache = await this.prisma.tache.findFirst({
      where: { id: tacheId, chantierId },
      select: TACHE_CONTEXTE,
    });
    if (!tache) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    return tache;
  }

  /** 404 (not 403) when the task is not assigned to him: never confirm it exists. */
  private async tacheAffectee(user: AuthUser, tacheId: number): Promise<TacheContexte> {
    const tache = await this.prisma.tache.findFirst({
      where: {
        id: tacheId,
        chantier: { companyId: user.companyId },
        affectations: { some: { userId: user.id } },
      },
      select: TACHE_CONTEXTE,
    });
    if (!tache) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    return tache;
  }
}

const TACHE_CONTEXTE = {
  id: true,
  libelle: true,
  chantierId: true,
  chantier: { select: { companyId: true, reference: true, chefChantierId: true } },
  affectations: { select: { userId: true } },
} satisfies Prisma.TacheSelect;

type TacheContexte = Prisma.TacheGetPayload<{ select: typeof TACHE_CONTEXTE }>;
