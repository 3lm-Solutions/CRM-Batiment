import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, paginate, toSkipTake } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FICHIER_SELECT, FichiersService } from '../../core/storage/fichiers.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import type { QueryReceptionsDto } from './commandes.dto';
import { type ReceptionEvent, ReceptionEvents } from './receptions.events';

const RECEPTION_INCLUDE = {
  commandeFournisseur: {
    select: {
      id: true,
      reference: true,
      statutLivraison: true,
      fournisseur: { select: { id: true, nom: true } },
      chantier: { select: { id: true, reference: true, adresse: true } },
      devis: { select: { id: true, reference: true, chantierId: true } },
    },
  },
  user: { select: { id: true, nom: true, prenom: true } },
  controlePar: { select: { id: true, nom: true, prenom: true } },
  lignes: {
    select: {
      id: true,
      quantite: true,
      ligneCommande: { select: { id: true, materiauNom: true, quantite: true, unite: true } },
    },
  },
  ecarts: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      type: true,
      libelle: true,
      quantite: true,
      commentaire: true,
      ligneCommande: { select: { id: true, materiauNom: true, quantite: true, unite: true } },
    },
  },
  fichiers: { select: FICHIER_SELECT, orderBy: { id: 'asc' } },
} satisfies Prisma.ReceptionInclude;

/**
 * 18/11 (mobile lot A): deliveries checked against their delivery note.
 * The chef sends the gaps and the photos; ADMIN / ASSISTANTE accept or refuse (« Commandes » tab
 * of the admin validations). No price anywhere in these answers.
 */
@Injectable()
export class ReceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fichiers: FichiersService,
    private readonly events: EventEmitter2,
  ) {}

  async liste(user: AuthUser, query: QueryReceptionsDto) {
    const where: Prisma.ReceptionWhereInput = {
      commandeFournisseur: this.scopeCommande(user),
      ...(query.statutControle && { statutControle: query.statutControle }),
      ...(query.commandeId && { commandeFournisseurId: query.commandeId }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reception.findMany({
        where,
        include: RECEPTION_INCLUDE,
        orderBy: [{ dateReception: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.reception.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async detail(user: AuthUser, id: number) {
    const reception = await this.prisma.reception.findFirst({
      where: { id, commandeFournisseur: this.scopeCommande(user) },
      include: RECEPTION_INCLUDE,
    });
    if (!reception) throw new NotFoundException(`Réception #${id} introuvable`);
    return reception;
  }

  /** Delivery note or photo of a missing / damaged item: the author of the reception or the office. */
  async ajouterFichier(
    user: AuthUser,
    id: number,
    file: UploadedBinary | undefined,
    position: { latitude: number; longitude: number } | null,
  ) {
    const reception = await this.detail(user, id);
    if (
      (user.role === Role.CHEF_CHANTIER || user.role === Role.SOUS_TRAITANT) &&
      reception.user?.id !== user.id
    ) {
      throw new NotFoundException(`Réception #${id} introuvable`);
    }
    // once decided, the file set is the proof the office looked at
    if (reception.statutControle === 'ACCEPTEE' || reception.statutControle === 'REFUSEE') {
      throw new BusinessException(
        'RECEPTION_DEJA_CONTROLEE',
        'Cette livraison a déjà été vérifiée par le bureau.',
      );
    }
    return this.fichiers.create(user, file, { receptionId: id }, undefined, { position });
  }

  valider(user: AuthUser, id: number) {
    return this.decider(user, id, 'ACCEPTEE', null);
  }

  refuser(user: AuthUser, id: number, motif: string) {
    return this.decider(user, id, 'REFUSEE', motif);
  }

  private async decider(
    user: AuthUser,
    id: number,
    decision: 'ACCEPTEE' | 'REFUSEE',
    motif: string | null,
  ) {
    const reception = await this.detail(user, id);
    if (reception.statutControle !== 'A_VERIFIER') {
      throw new BusinessException(
        'RECEPTION_NON_A_VERIFIER',
        reception.statutControle === 'SANS_ECART'
          ? 'Cette livraison n’a pas d’écart : il n’y a rien à vérifier.'
          : 'Cette livraison a déjà été vérifiée.',
      );
    }
    const { count } = await this.prisma.reception.updateMany({
      where: { id, statutControle: 'A_VERIFIER' },
      data: {
        statutControle: decision,
        motifRefus: motif,
        controleParId: user.id,
        controleLe: new Date(),
      },
    });
    if (!count) {
      throw new BusinessException(
        'RECEPTION_MODIFIEE',
        'Cette livraison vient d’être vérifiée par quelqu’un d’autre. Rechargez.',
        409,
      );
    }
    this.events.emit(ReceptionEvents.CONTROLEE, {
      companyId: user.companyId,
      receptionId: id,
      commandeId: reception.commandeFournisseur.id,
      reference: reception.commandeFournisseur.reference,
      auteurId: reception.user?.id ?? null,
      userId: user.id,
      decision,
      motif,
    } satisfies ReceptionEvent);
    return this.detail(user, id);
  }

  /** Same scope as the orders: a chef sees the deliveries of his job sites. */
  private scopeCommande(user: AuthUser): Prisma.CommandeFournisseurWhereInput {
    if (user.role === Role.SOUS_TRAITANT) {
      const mienne = { installation: { sousTraitant: { userId: user.id } } };
      return {
        companyId: user.companyId,
        OR: [{ chantier: mienne }, { devis: { chantier: mienne } }],
      };
    }
    if (user.role !== Role.CHEF_CHANTIER) return { companyId: user.companyId };
    return {
      companyId: user.companyId,
      OR: [
        { devis: { chantier: { chefChantierId: user.id } } },
        { chantier: { chefChantierId: user.id } },
      ],
    };
  }
}
