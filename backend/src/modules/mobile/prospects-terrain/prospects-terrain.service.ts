import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AuthUser,
  BUREAU,
  BusinessException,
  paginate,
  ReferencePrefix,
  ReferenceService,
  toSkipTake,
} from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DemandesDevisService } from '../../commercial/demandes-devis/demandes-devis.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { ClientsService } from '../../referentiel/clients/clients.service';
import type { CreerProspectTerrainDto, QueryProspectsTerrainDto } from './prospects-terrain.dto';
import { type ProspectTerrainCreeEvent, ProspectTerrainEvents } from './prospects-terrain.events';

/** What the sender sees: never an amount (he may be a chef de chantier). */
const SELECT = {
  id: true,
  reference: true,
  statut: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, nom: true, prenom: true, telephone: true, adresseClient: true } },
  devis: { select: { id: true, reference: true, statut: true }, orderBy: { createdAt: 'desc' } },
  _count: { select: { fichiers: true } },
} satisfies Prisma.DemandeDevisSelect;

/**
 * 16/11 (mobile lot 1) — « prospect terrain »: a chef de chantier (or anyone of the team) meets
 * someone on a job site who wants works. He enters the contact and the need, adds photos or a
 * voice note; the sales team (TECHNICO + ADMIN) is notified and takes it from there.
 * The sender follows his prospects (status of the request, quote made or not) without amounts.
 */
@Injectable()
export class ProspectsTerrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly clients: ClientsService,
    private readonly demandes: DemandesDevisService,
    private readonly events: EventEmitter2,
  ) {}

  async creer(user: AuthUser, dto: CreerProspectTerrainDto) {
    if (!dto.clientId === !dto.client) {
      throw new BusinessException(
        'CLIENT_MANQUANT',
        'Indiquez soit un client existant (clientId), soit le nouveau contact (client).',
      );
    }
    let clientNom: string;
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId: user.companyId },
        select: { nom: true, prenom: true, archivedAt: true },
      });
      if (!client) throw new NotFoundException(`Client #${dto.clientId} introuvable`);
      if (client.archivedAt)
        throw new BusinessException('CLIENT_ARCHIVE', 'Ce client est archivé.');
      clientNom = [client.prenom, client.nom].filter(Boolean).join(' ');
    } else {
      const c = dto.client!;
      if (!c.telephone && !c.email) {
        throw new BusinessException(
          'CONTACT_MANQUANT',
          'Indiquez au moins un téléphone ou un email pour que le commercial puisse rappeler.',
        );
      }
      if (!dto.creerQuandMeme) {
        await this.clients.assertPasDeDoublon(user.companyId, c, user.role !== Role.CHEF_CHANTIER);
      }
      clientNom = [c.prenom, c.nom].filter(Boolean).join(' ');
    }

    const demande = await this.prisma.$transaction(async (tx) => {
      let clientId = dto.clientId;
      if (!clientId) {
        const c = dto.client!;
        const pro = c.typeClient === 'PROFESSIONNEL';
        ({ id: clientId } = await tx.client.create({
          data: {
            companyId: user.companyId,
            typeClient: c.typeClient ?? 'PARTICULIER',
            nom: c.nom,
            prenom: pro ? null : (c.prenom ?? null),
            telephone: c.telephone ?? null,
            email: c.email ?? null,
            adresseClient: c.adresse ?? null,
            adresseChantier: c.adresse ?? null,
            besoin: dto.description,
            source: 'TERRAIN',
            statut: 'PROSPECT',
          },
          select: { id: true },
        }));
      }
      return tx.demandeDevis.create({
        data: {
          companyId: user.companyId,
          clientId,
          description: dto.description,
          besoinStructure: dto.besoinStructure as Prisma.InputJsonValue | undefined,
          source: 'TERRAIN',
          createurId: user.id,
          reference: await this.references.next(ReferencePrefix.DEMANDE, user.companyId, tx),
        },
        select: { id: true, reference: true },
      });
    });

    const auteur = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { nom: true, prenom: true },
    });
    this.events.emit(ProspectTerrainEvents.CREE, {
      companyId: user.companyId,
      demandeId: demande.id,
      reference: demande.reference,
      clientNom,
      auteurId: user.id,
      auteurNom: `${auteur.prenom} ${auteur.nom}`,
    } satisfies ProspectTerrainCreeEvent);
    return this.detail(user, demande.id);
  }

  /** My terrain prospects (the office sees every terrain prospect of the company). */
  async liste(user: AuthUser, query: QueryProspectsTerrainDto) {
    const where: Prisma.DemandeDevisWhereInput = {
      companyId: user.companyId,
      source: 'TERRAIN',
      ...(!BUREAU.includes(user.role) && { createurId: user.id }),
      ...(query.statut && { statut: query.statut }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.demandeDevis.findMany({
        where,
        select: { ...SELECT, createur: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.demandeDevis.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async detail(user: AuthUser, id: number) {
    await this.assertVisible(user, id);
    return this.prisma.demandeDevis.findUniqueOrThrow({
      where: { id },
      select: {
        ...SELECT,
        besoinStructure: true,
        createur: { select: { id: true, nom: true, prenom: true } },
        fichiers: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            dureeSecondes: true,
            createdAt: true,
            fichier: { select: { id: true, nom: true, mime: true, taille: true } },
          },
        },
      },
    });
  }

  async ajouterFichier(
    user: AuthUser,
    id: number,
    file: UploadedBinary | undefined,
    dureeSecondes?: number,
  ) {
    await this.assertVisible(user, id);
    return this.demandes.ajouterFichier(user, id, file, dureeSecondes);
  }

  async supprimerFichier(user: AuthUser, id: number, pieceId: number): Promise<void> {
    await this.assertVisible(user, id);
    return this.demandes.supprimerFichier(user, id, pieceId);
  }

  /** 404 when it is not a terrain prospect of mine (the office sees them all). */
  private async assertVisible(user: AuthUser, id: number): Promise<void> {
    const ok = await this.prisma.demandeDevis.count({
      where: {
        id,
        companyId: user.companyId,
        source: 'TERRAIN',
        ...(!BUREAU.includes(user.role) && { createurId: user.id }),
      },
    });
    if (!ok) throw new NotFoundException(`Prospect #${id} introuvable`);
  }
}
