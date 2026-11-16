import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AuthUser, BusinessException } from '../../../common';
import type { Env } from '../../../config/env.validation';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';
import {
  alerteClientChefMail,
  retourReponseClientMail,
} from '../../core/mail/templates/portails.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRetourClientDto, QueryRetoursDto, RepondreRetourDto } from './retours-client.dto';
import { assertChantierOuvertAuxRetours, assertQuotaRetours, objetRetour } from './retours-rules';

const RETOUR_SELECT = {
  id: true,
  type: true,
  message: true,
  statut: true,
  reponse: true,
  reponduLe: true,
  traiteLe: true,
  createdAt: true,
  chantierId: true,
  tache: { select: { id: true, libelle: true } },
  photo: { select: { id: true, moment: true, date: true, fichierId: true } },
  reponduPar: { select: { id: true, nom: true, prenom: true } },
  traitePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.RetourClientSelect;

const nomComplet = (p: { prenom: string | null; nom: string }) =>
  [p.prenom, p.nom].filter(Boolean).join(' ');

/**
 * Comments and alerts of the client on his job sites (Étapes 5–6 of 26/10).
 *  - the client writes from his online space (no account: the space token identifies him);
 *  - the chef of the job site and the ADMINs are told (an alert is also emailed to the chef);
 *  - the chef / ADMIN / ASSISTANTE answers — shown in the client space and emailed — and marks it handled.
 */
@Injectable()
export class RetoursClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── client side (called by the client space, after the token check) ──────

  async creerParClient(companyId: number, clientId: number, dto: CreateRetourClientDto) {
    const chantier = await this.prisma.chantier.findFirst({
      where: { id: dto.chantierId, companyId, clientId },
      select: {
        id: true,
        reference: true,
        statut: true,
        chefChantierId: true,
        client: { select: { nom: true, prenom: true, typeClient: true, contactNom: true } },
      },
    });
    if (!chantier)
      throw new BusinessException('LIEN_INVALIDE', 'Ce chantier ne vous concerne pas.');
    assertChantierOuvertAuxRetours(chantier.statut);
    assertQuotaRetours(
      await this.prisma.retourClient.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
    );

    // A photo: only a validated one of this job site; its task is taken from it
    let tacheId = dto.tacheId ?? null;
    let photo: { id: number; moment: 'AVANT' | 'APRES'; date: Date } | null = null;
    if (dto.photoId) {
      const p = await this.prisma.photoAvancement.findFirst({
        where: { id: dto.photoId, chantierId: chantier.id, statut: 'VALIDEE' },
        select: { id: true, tacheId: true, moment: true, date: true },
      });
      if (!p) throw new BusinessException('PHOTO_INVALIDE', 'Cette photo n’est pas disponible.');
      if (tacheId && tacheId !== p.tacheId)
        throw new BusinessException('PHOTO_INVALIDE', 'Cette photo ne correspond pas à la tâche.');
      tacheId = p.tacheId;
      photo = p;
    }
    let tache: { libelle: string } | null = null;
    if (tacheId) {
      tache = await this.prisma.tache.findFirst({
        where: { id: tacheId, chantierId: chantier.id },
        select: { libelle: true },
      });
      if (!tache)
        throw new BusinessException('TACHE_INVALIDE', 'Cette tâche n’appartient pas au chantier.');
    }

    const created = await this.prisma.retourClient.create({
      data: {
        companyId,
        clientId,
        chantierId: chantier.id,
        tacheId,
        photoId: photo?.id ?? null,
        type: dto.type,
        message: dto.message,
      },
      select: RETOUR_SELECT,
    });

    // Who is told: the chef of the job site + the ADMINs (decision of 26/10); no chef → ADMIN + ASSISTANTE
    const alerte = dto.type === 'ALERTE';
    const clientNom =
      chantier.client.typeClient === 'PROFESSIONNEL' && chantier.client.contactNom
        ? `${chantier.client.nom} (${chantier.client.contactNom})`
        : nomComplet(chantier.client);
    const objet = objetRetour({ chantier: chantier.reference, tache: tache?.libelle, photo });
    const lien = `/chantiers/${chantier.id}?onglet=retours`;
    const extrait = dto.message.length > 140 ? `${dto.message.slice(0, 140)}…` : dto.message;
    await this.notifications.notifyRoles(
      companyId,
      chantier.chefChantierId ? [Role.ADMIN] : [Role.ADMIN, Role.ASSISTANTE],
      {
        type: alerte ? 'RETOUR_CLIENT_ALERTE' : 'RETOUR_CLIENT_COMMENTAIRE',
        titre: alerte
          ? `⚠ Alerte client — ${chantier.reference}`
          : `Commentaire client — ${chantier.reference}`,
        message: `${clientNom} sur ${objet} : ${extrait}`,
        lien,
        ...(alerte ? { niveau: 'ALERTE' as const } : {}),
      },
      [chantier.chefChantierId],
    );
    if (alerte && chantier.chefChantierId) {
      const chef = await this.prisma.user.findUnique({
        where: { id: chantier.chefChantierId },
        select: { email: true, nom: true, prenom: true, actif: true },
      });
      if (chef?.actif && chef.email) {
        await this.mail.send(
          chef.email,
          alerteClientChefMail({
            chefNom: nomComplet(chef),
            clientNom,
            chantier: chantier.reference,
            objet,
            message: dto.message,
            url: `${this.appUrl()}${lien}`,
          }),
        );
      }
    }
    return created;
  }

  /** What the client sees of his messages (with the answers), per job site. */
  pourClient(companyId: number, clientId: number) {
    return this.prisma.retourClient.findMany({
      where: { companyId, clientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        chantierId: true,
        type: true,
        message: true,
        statut: true,
        reponse: true,
        reponduLe: true,
        createdAt: true,
        tacheId: true,
        photoId: true,
      },
    });
  }

  // ── office / chef ─────────────────────────────────────────────────────────

  async liste(user: AuthUser, chantierId: number, q: QueryRetoursDto) {
    await this.assertChantier(user, chantierId);
    const [data, ouverts] = await Promise.all([
      this.prisma.retourClient.findMany({
        where: { chantierId, statut: q.statut, type: q.type },
        select: RETOUR_SELECT,
        // Open alerts first, then open comments, then the handled ones — newest first in each
        orderBy: [{ statut: 'asc' }, { type: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      }),
      this.prisma.retourClient.groupBy({
        by: ['type'],
        where: { chantierId, statut: 'OUVERT' },
        _count: { _all: true },
        orderBy: { type: 'asc' },
      }),
    ]);
    const n = (t: string) => ouverts.find((x) => x.type === t)?._count?._all ?? 0;
    return {
      data,
      totaux: { alertesOuvertes: n('ALERTE'), commentairesOuverts: n('COMMENTAIRE') },
    };
  }

  async repondre(user: AuthUser, chantierId: number, id: number, dto: RepondreRetourDto) {
    const retour = await this.find(user, chantierId, id);
    const traite = dto.traite ?? true;
    const now = new Date();
    const updated = await this.prisma.retourClient.update({
      where: { id: retour.id },
      data: {
        reponse: dto.reponse,
        reponduParId: user.id,
        reponduLe: now,
        ...(traite ? { statut: 'TRAITE', traiteParId: user.id, traiteLe: now } : {}),
      },
      select: RETOUR_SELECT,
    });
    await this.emailClient(retour.id, dto.reponse, traite);
    return updated;
  }

  async traiter(user: AuthUser, chantierId: number, id: number) {
    const retour = await this.find(user, chantierId, id);
    return this.prisma.retourClient.update({
      where: { id: retour.id },
      data: { statut: 'TRAITE', traiteParId: user.id, traiteLe: new Date() },
      select: RETOUR_SELECT,
    });
  }

  async rouvrir(user: AuthUser, chantierId: number, id: number) {
    const retour = await this.find(user, chantierId, id);
    return this.prisma.retourClient.update({
      where: { id: retour.id },
      data: { statut: 'OUVERT', traiteParId: null, traiteLe: null },
      select: RETOUR_SELECT,
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Never blocks the answer: an email that fails is logged by MailService. */
  private async emailClient(retourId: number, reponse: string, traite: boolean) {
    const r = await this.prisma.retourClient.findUniqueOrThrow({
      where: { id: retourId },
      select: {
        message: true,
        clientId: true,
        client: {
          select: {
            nom: true,
            prenom: true,
            email: true,
            archivedAt: true,
            typeClient: true,
            contactNom: true,
          },
        },
        chantier: { select: { reference: true } },
        company: { select: { nom: true } },
        tache: { select: { libelle: true } },
        photo: { select: { moment: true, date: true } },
      },
    });
    if (!r.client.email || r.client.archivedAt) return;
    const espaceActif = await this.prisma.clientEspaceLien.count({
      where: { clientId: r.clientId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    await this.mail.send(
      r.client.email,
      retourReponseClientMail({
        clientNom:
          r.client.typeClient === 'PROFESSIONNEL' && r.client.contactNom
            ? r.client.contactNom
            : nomComplet(r.client),
        entreprise: r.company.nom,
        chantier: r.chantier.reference,
        objet: objetRetour({
          chantier: r.chantier.reference,
          tache: r.tache?.libelle,
          photo: r.photo,
        }),
        message: r.message,
        reponse,
        traite,
        avecEspaceClient: espaceActif > 0,
      }),
    );
  }

  private async find(user: AuthUser, chantierId: number, id: number) {
    await this.assertChantier(user, chantierId);
    const retour = await this.prisma.retourClient.findFirst({
      where: { id, chantierId },
      select: { id: true },
    });
    if (!retour) throw new NotFoundException(`Message #${id} introuvable`);
    return retour;
  }

  /** Same scope as the job site: the chef sees his own job sites only. */
  private async assertChantier(user: AuthUser, chantierId: number) {
    const ok = await this.prisma.chantier.count({
      where: {
        id: chantierId,
        companyId: user.companyId,
        ...(user.role === Role.CHEF_CHANTIER ? { chefChantierId: user.id } : {}),
      },
    });
    if (!ok) throw new NotFoundException(`Chantier #${chantierId} introuvable`);
  }

  private appUrl() {
    return this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');
  }
}
