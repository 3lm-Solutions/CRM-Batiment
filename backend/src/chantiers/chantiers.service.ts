import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateDocumentChantierDto } from './dto/create-document-chantier.dto.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TacheStatut } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreateChantierDto } from './dto/create-chantier.dto.js';
import { QueryChantierDto } from './dto/query-chantier.dto.js';
import { CreateTacheDto, TaskAssignmentType } from './dto/create-tache.dto.js';
import { UpdateChantierDto } from './dto/update-chantier.dto.js';
import { UpdateTacheDto } from './dto/update-tache.dto.js';
import { WorkflowStateService } from '../common/workflow-state.service.js';

@Injectable()
export class ChantiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowStateService: WorkflowStateService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isTaskDone(task: { statut: TacheStatut; avancement: number }) {
    return task.statut === 'TERMINEE' || task.avancement >= 100;
  }

  private computeChantierAutoStatus(
    tasks: Array<{
      statut: TacheStatut;
      avancement: number;
      dateFin?: Date | null;
    }>,
  ) {
    if (tasks.length === 0) {
      return 'EN_ATTENTE' as const;
    }

    const doneCount = tasks.filter((task) => this.isTaskDone(task)).length;

    if (doneCount === tasks.length) {
      return 'CLOTURE' as const;
    }

    const now = Date.now();
    const hasLateTask = tasks.some(
      (task) =>
        !this.isTaskDone(task) &&
        !!task.dateFin &&
        new Date(task.dateFin).getTime() < now,
    );

    if (hasLateTask) {
      return 'EN_RETARD' as const;
    }

    if (doneCount === 0) {
      return 'EN_ATTENTE' as const;
    }

    return 'EN_COURS' as const;
  }

  private buildTaskSummary(
    tasks: Array<{
      statut: TacheStatut;
      avancement: number;
      dateFin?: Date | null;
    }>,
  ) {
    const now = Date.now();
    const done = tasks.filter((task) => this.isTaskDone(task)).length;
    const overdue = tasks.filter(
      (task) =>
        !this.isTaskDone(task) &&
        !!task.dateFin &&
        new Date(task.dateFin).getTime() < now,
    ).length;

    return {
      total: tasks.length,
      done,
      pending: Math.max(0, tasks.length - done),
      overdue,
    };
  }

  private ensureTaskDateRange(dateDebut?: string, dateFin?: string) {
    if (!dateDebut || !dateFin) {
      return;
    }

    const start = new Date(dateDebut).getTime();
    const end = new Date(dateFin).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new BadRequestException('Dates de tache invalides.');
    }

    if (end < start) {
      throw new BadRequestException(
        'La date de fin de tache doit etre superieure ou egale a la date de debut.',
      );
    }
  }

  private async ensureChantierInCompany(chantierId: number, companyId: number) {
    const chantier = await this.prisma.chantier.findFirst({
      where: { id: chantierId, companyId },
      select: {
        id: true,
        reference: true,
        client: {
          select: { id: true, nom: true, prenom: true },
        },
      },
    });

    if (!chantier) {
      throw new NotFoundException(
        `Chantier #${chantierId} introuvable dans votre entreprise.`,
      );
    }

    return chantier;
  }

  private async ensureSousTraitantInCompany(userId: number, companyId: number) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: Role.SOUS_TRAITANT,
        actif: true,
      },
      select: { id: true, nom: true, prenom: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(
        `Sous-traitant #${userId} introuvable dans votre entreprise.`,
      );
    }

    return user;
  }

  private async ensureEquipeInterneInCompany(
    equipeId: number,
    companyId: number,
  ) {
    const equipe = await this.prisma.equipe.findFirst({
      where: { id: equipeId, companyId, type: 'INTERNE', actif: true },
      select: { id: true, nom: true, type: true },
    });

    if (!equipe) {
      throw new NotFoundException(
        `Equipe interne #${equipeId} introuvable dans votre entreprise.`,
      );
    }

    return equipe;
  }

  private async ensureDefaultInterneEquipe(companyId: number) {
    const existing = await this.prisma.equipe.findFirst({
      where: { companyId, type: 'INTERNE', actif: true },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    await this.prisma.equipe.create({
      data: {
        companyId,
        nom: 'Equipe interne principale',
        type: 'INTERNE',
        actif: true,
      },
    });
  }

  private async resolveTaskAssignment(
    dto: Pick<CreateTacheDto, 'assigneeType' | 'sousTraitantId' | 'equipeId'>,
    companyId: number,
  ) {
    if (!dto.assigneeType || dto.assigneeType === TaskAssignmentType.AUCUNE) {
      return null;
    }

    if (dto.assigneeType === TaskAssignmentType.SOUS_TRAITANT) {
      if (!dto.sousTraitantId) {
        throw new BadRequestException(
          'sousTraitantId est obligatoire pour une affectation SOUS_TRAITANT.',
        );
      }
      await this.ensureSousTraitantInCompany(dto.sousTraitantId, companyId);
      return { userId: dto.sousTraitantId, equipeId: null };
    }

    if (!dto.equipeId) {
      throw new BadRequestException(
        'equipeId est obligatoire pour une affectation EQUIPE_INTERNE.',
      );
    }
    await this.ensureEquipeInterneInCompany(dto.equipeId, companyId);
    return { userId: null, equipeId: dto.equipeId };
  }

  private mapTaskWithAssignment(task: any) {
    const firstAffectation = task.affectations[0] ?? null;

    return {
      ...task,
      done: this.isTaskDone(task),
      affectation: !firstAffectation
        ? null
        : firstAffectation.user
          ? {
              id: firstAffectation.id,
              type: 'SOUS_TRAITANT' as const,
              user: firstAffectation.user,
            }
          : firstAffectation.equipe
            ? {
                id: firstAffectation.id,
                type: 'EQUIPE_INTERNE' as const,
                equipe: firstAffectation.equipe,
              }
            : null,
    };
  }

  private async generateReference(companyId: number) {
    const year = new Date().getFullYear();
    const prefix = `CH-${year}-`;

    const lastChantier = await this.prisma.chantier.findFirst({
      where: {
        companyId,
        reference: { startsWith: prefix },
      },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });

    const lastSegment = lastChantier?.reference?.split('-').at(-1) ?? '';
    const parsed = Number.parseInt(lastSegment, 10);
    const nextNumber = Number.isFinite(parsed) ? parsed + 1 : 1;

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  private buildDetailedDescriptionFromDevis(input: {
    devisReference: string;
    clientNom: string;
    clientPrenom?: string | null;
    notes?: string | null;
    lignes: Array<{
      quantite: number;
      unite: string;
      description?: string | null;
      prestation?: { nom: string } | null;
      materiau?: { nom: string } | null;
      serviceMainOeuvre?: { nom: string } | null;
    }>;
  }) {
    const formatPersonName = (prenom?: string | null, nom?: string | null) => {
      const normalizePart = (value?: string | null) =>
        (value ?? '')
          .trim()
          .toLowerCase()
          .replace(/\b\w/g, (char) => char.toUpperCase());

      return [normalizePart(prenom), normalizePart(nom)].filter(Boolean).join(' ');
    };

    const normalizeUnit = (unit?: string | null) => {
      const raw = (unit ?? '').trim();
      if (!raw) {
        return 'u';
      }
      const lowered = raw.toLowerCase();
      if (lowered === 'm2') {
        return 'm2';
      }
      return lowered;
    };

    const normalizeRequestContext = (rawNotes?: string | null) => {
      const raw = (rawNotes ?? '').trim();
      if (!raw) {
        return null;
      }

      let cleaned = raw
        .replace(/^cree\s+depuis\s+/i, '')
        .replace(/^la\s+demande\s+/i, 'la demande ')
        .replace(/—/g, '-')
        .replace(/\s+-\s+/g, ' - ')
        .trim();

      const demandeMatch = cleaned.match(/demande\s*#?\s*(\d+)/i);
      if (!demandeMatch) {
        return cleaned;
      }

      const demandeId = demandeMatch[1];
      const afterDemand = cleaned
        .replace(/.*demande\s*#?\s*\d+\s*/i, '')
        .replace(/^[-:]\s*/, '')
        .trim();

      const topic = afterDemand
        ? afterDemand
            .split(' - ')[0]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .join(' & ')
        : null;

      return topic
        ? `la demande #${demandeId} - ${topic}`
        : `la demande #${demandeId}`;
    };

    const travaux = input.lignes.slice(0, 12).map((ligne) => {
      const label =
        ligne.description?.trim() ||
        ligne.prestation?.nom ||
        ligne.materiau?.nom ||
        ligne.serviceMainOeuvre?.nom ||
        'travaux a preciser';

      return `${label} (${ligne.quantite} ${normalizeUnit(ligne.unite)})`;
    });

    const clientFullName = formatPersonName(input.clientPrenom, input.clientNom);
    const detailTravaux =
      travaux.length === 0
        ? 'travaux a preciser'
        : travaux.length === 1
          ? travaux[0]
          : `${travaux.slice(0, -1).join(', ')} ainsi que ${travaux.at(-1)}`;
    const notes = normalizeRequestContext(input.notes);
    const notesSuffix = notes ? ` suite a ${notes}` : '';

    return [
      `Travaux de renovation interieure realises pour le client ${clientFullName || input.clientNom}, comprenant ${detailTravaux}.`,
      `Chantier cree a partir du devis ${input.devisReference}${notesSuffix}.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private async ensureClientInCompany(clientId: number, companyId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        adresseChantier: true,
        adresseClient: true,
      },
    });

    if (!client) {
      throw new NotFoundException(
        `Client #${clientId} introuvable dans votre entreprise.`,
      );
    }

    return client;
  }

  private async ensureChefInCompany(chefChantierId: number, companyId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: chefChantierId, companyId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(
        `Utilisateur #${chefChantierId} introuvable dans votre entreprise.`,
      );
    }
  }

  async syncFromAcceptedDevis(currentUser: CurrentUserPayload) {
    const devisList = await this.prisma.devis.findMany({
      where: {
        companyId: currentUser.companyId,
        statut: { in: ['ACCEPTE', 'SIGNE'] },
      },
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            adresseChantier: true,
            adresseClient: true,
          },
        },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            prestation: { select: { nom: true } },
            materiau: { select: { nom: true } },
            serviceMainOeuvre: { select: { nom: true } },
          },
        },
        commandesFournisseur: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    });

    let created = 0;
    let alreadyLinked = 0;

    for (const devis of devisList) {
      if (devis.chantierId) {
        alreadyLinked += 1;
        continue;
      }

      const baseReference = `CH-${devis.reference}`;
      let reference = baseReference;
      let suffix = 1;

      while (await this.prisma.chantier.findUnique({ where: { reference } })) {
        suffix += 1;
        reference = `${baseReference}-${suffix}`;
      }

      const adresse =
        devis.client.adresseChantier?.trim() ||
        devis.client.adresseClient?.trim() ||
        'Adresse chantier a confirmer';

      const chantier = await this.prisma.chantier.create({
        data: {
          companyId: devis.companyId,
          clientId: devis.clientId,
          reference,
          adresse,
          description: this.buildDetailedDescriptionFromDevis({
            devisReference: devis.reference,
            clientNom: devis.client.nom,
            clientPrenom: devis.client.prenom,
            notes: devis.notes,
            lignes: devis.lignes,
          }),
          statut:
            devis.commandesFournisseur.length > 0
              ? 'COMMANDES_GENEREES'
              : 'DEVIS_VALIDE',
        },
        select: { id: true },
      });

      await this.prisma.devis.update({
        where: { id: devis.id },
        data: { chantierId: chantier.id },
      });

      created += 1;
    }

    return {
      message: 'Synchronisation chantiers terminee.',
      summary: {
        totalAcceptedOrSignedDevis: devisList.length,
        created,
        alreadyLinked,
      },
    };
  }

  async refreshDescriptionsFromLinkedDevis(currentUser: CurrentUserPayload) {
    const devisList = await this.prisma.devis.findMany({
      where: {
        companyId: currentUser.companyId,
        chantierId: { not: null },
      },
      include: {
        client: {
          select: {
            nom: true,
            prenom: true,
          },
        },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: {
            prestation: { select: { nom: true } },
            materiau: { select: { nom: true } },
            serviceMainOeuvre: { select: { nom: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    let updated = 0;

    for (const devis of devisList) {
      if (!devis.chantierId) {
        continue;
      }

      const description = this.buildDetailedDescriptionFromDevis({
        devisReference: devis.reference,
        clientNom: devis.client.nom,
        clientPrenom: devis.client.prenom,
        notes: devis.notes,
        lignes: devis.lignes,
      });

      await this.prisma.chantier.update({
        where: { id: devis.chantierId },
        data: { description },
      });

      updated += 1;
    }

    return {
      message: 'Descriptions de chantiers regenerees.',
      summary: {
        totalLinkedDevis: devisList.length,
        updated,
      },
    };
  }

  async findAll(query: QueryChantierDto, currentUser: CurrentUserPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    //avant //
    //const where: Prisma.ChantierWhereInput = {
    // companyId: currentUser.companyId,
    //};
    //apres : //
    const where: Prisma.ChantierWhereInput = {
      companyId: currentUser.companyId,
    };

    // Filtrer les chantiers selon le rôle de l'utilisateur
    if (currentUser.role === Role.CHEF_CHANTIER) {
      where.chefChantierId = currentUser.userId;
    } else if (currentUser.role === Role.SOUS_TRAITANT) {
      where.taches = {
        some: {
          affectations: {
            some: {
              userId: currentUser.userId,
            },
          },
        },
      };
    } 
    // fin apres 
    if (query.statut) {
      where.statut = query.statut;
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { adresse: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          client: {
            is: {
              OR: [
                { nom: { contains: search, mode: 'insensitive' } },
                { prenom: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.chantier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              telephone: true,
              email: true,
            },
          },
          chefChantier: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
            },
          },
          _count: {
            select: {
              devis: true,
              taches: true,
              documents: true,
            },
          },
          taches: {
            select: {
              id: true,
              statut: true,
              avancement: true,
              dateDebut: true,
              dateFin: true,
            },
          },
        },
      }),
      this.prisma.chantier.count({ where }),
    ]);

    const enriched = data.map((chantier) => {
      const statutAuto = this.computeChantierAutoStatus(chantier.taches);
      const resumeTaches = this.buildTaskSummary(chantier.taches);
      const { taches, ...rest } = chantier;
      return {
        ...rest,
        statutAuto,
        resumeTaches,
      };
    });

    return {
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /*async findOne(id: number, currentUser: CurrentUserPayload) {
    const chantier = await this.prisma.chantier.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: {
        client: true,
        chefChantier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            role: true,
          },
        },
        devis: {
          select: {
            id: true,
            reference: true,
            statut: true,
            totalTTC: true,
            dateValidation: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        taches: {
          orderBy: { ordre: 'asc' },
          include: {
            affectations: {
              include: {
                user: {
                  select: { id: true, nom: true, prenom: true, email: true },
                },
                equipe: {
                  select: { id: true, nom: true, type: true },
                },
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        sousTraitantsVisibles: {
          select: { sousTraitant: { select: { id: true, nom: true, prenom: true, email: true } } },
        },
        },
      },
    });

    if (!chantier) {
      throw new NotFoundException(`Chantier #${id} introuvable.`);
    }

    const mappedTasks = chantier.taches.map((task) =>
      this.mapTaskWithAssignment(task),
    );

    return {
      ...chantier,
      taches: mappedTasks,
      statutAuto: this.computeChantierAutoStatus(chantier.taches),
      resumeTaches: this.buildTaskSummary(chantier.taches),
    };
  }
  */

  //apres modif //
  async findOne(id: number, currentUser: CurrentUserPayload) {
    const where: Prisma.ChantierWhereInput = {
      id,
      companyId: currentUser.companyId,
    };

    //restriction d'acces selon le role 
    if (currentUser.role === Role.CHEF_CHANTIER) {
      where.chefChantierId = currentUser.userId;
    } else if (currentUser.role === Role.SOUS_TRAITANT) {
      where.taches = {
        some: {
          affectations: {
            some: {
              userId: currentUser.userId,
            },
          },
        },
      };
    }

    const chantier = await this.prisma.chantier.findFirst({
      where,
      include: {
        client: true,
        chefChantier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            role: true,
          },
        },
        devis: {
          select: {
            id: true,
            reference: true,
            statut: true,
            totalTTC: true,
            dateValidation: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        taches: {
          orderBy: { ordre: 'asc' },
          include: {
            affectations: {
              include: {
                user: {
                  select: { id: true, nom: true, prenom: true, email: true },
                },
                equipe: {
                  select: { id: true, nom: true, type: true },
                },
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!chantier) {
      throw new NotFoundException(`Chantier #${id} introuvable.`);
    }

    const mappedTasks = chantier.taches.map((task) =>
      this.mapTaskWithAssignment(task),
    );

    //verification des acces aux données financieres du chantier selon le role de l'utilisateur
    const isCommercialAllowed =
      currentUser.role === Role.ADMIN ||
      currentUser.role === Role.ASSISTANTE ||
      currentUser.role === Role.TECHNICO;

    const response = {
      sousTraitantsVisibles: (chantier as any).sousTraitantsVisibles?.map((item: any) => item.sousTraitant) ?? [],
      ...chantier,
      taches: mappedTasks,
      statutAuto: this.computeChantierAutoStatus(chantier.taches),
      resumeTaches: this.buildTaskSummary(chantier.taches),
    };
    
    //masquage des devis si pas commercial ou admin 
    if (!isCommercialAllowed) {
      delete (response as any).devis;
    }

    return response;
  }
  // fin modif // 

  async updateVisibility(
    id: number,
    sousTraitantIds: number[],
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureChantierInCompany(id, currentUser.companyId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: sousTraitantIds }, companyId: currentUser.companyId, role: Role.SOUS_TRAITANT, actif: true },
      select: { id: true },
    });
    if (users.length !== sousTraitantIds.length) {
      throw new BadRequestException('Un ou plusieurs sous-traitants sont invalides.');
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.chantierSousTraitant.deleteMany({ where: { chantierId: id } });
      await transaction.chantierSousTraitant.createMany({
        data: sousTraitantIds.map((sousTraitantId) => ({ chantierId: id, sousTraitantId })),
      });
    });
    return this.findOne(id, currentUser);
  }

  async savePlan2d(
    id: number,
    plan2d: Record<string, unknown>,
    currentUser: CurrentUserPayload,
    imageDataUrl?: string,
  ) {
    const chantier = await this.ensureChantierInCompany(id, currentUser.companyId);
    const documentUrl = imageDataUrl?.startsWith('data:image/')
      ? imageDataUrl
      : `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(plan2d))}`;
    const documentName = imageDataUrl?.startsWith('data:image/')
      ? `Plan 2D - ${chantier.reference}.png`
      : `Plan 2D - ${chantier.reference}.json`;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentChantier.deleteMany({
        where: { chantierId: id, type: 'PLAN_2D' },
      });
      await transaction.chantier.update({
        where: { id },
        data: { plan2d: plan2d as Prisma.InputJsonValue },
      });
      await transaction.documentChantier.create({
        data: {
          chantierId: id,
          nom: documentName,
          type: 'PLAN_2D',
          url: documentUrl,
        },
      });
    });

    return this.findOne(id, currentUser);
  }

  async removePlan2d(id: number, currentUser: CurrentUserPayload) {
    await this.ensureChantierInCompany(id, currentUser.companyId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.documentChantier.deleteMany({
        where: { chantierId: id, type: 'PLAN_2D' },
      });
      await transaction.chantier.update({
        where: { id },
        data: { plan2d: Prisma.JsonNull },
      });
    });

    return this.findOne(id, currentUser);
  }

  async createDocument(
    chantierId: number,
    dto: CreateDocumentChantierDto,
    currentUser: CurrentUserPayload,
  ) {
    const chantier = await this.ensureChantierInCompany(
      chantierId,
      currentUser.companyId,
    );

    const document = await this.prisma.documentChantier.create({
      data: {
        chantierId,
        nom: dto.nom.trim(),
        type: dto.type.trim().toUpperCase(),
        url: dto.url.trim(),
      },
    });

    await this.notificationsService.createInternalNotification({
      companyId: currentUser.companyId,
      userId: currentUser.userId,
      action: 'NOTIFICATION_CHANTIER_DOCUMENT_ADDED',
      entite: 'DocumentChantier',
      entiteId: document.id,
      category: 'CHANTIER_DOCUMENT',
      level: 'info',
      title: 'Nouveau document chantier',
      message: `${document.nom} a été ajouté au chantier ${chantier.reference}.`,
      metadata: {
        chantierId,
        chantierReference: chantier.reference,
        documentType: document.type,
      },
    });

    return document;
  }

  async removeDocument(
    chantierId: number,
    documentId: number,
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureChantierInCompany(chantierId, currentUser.companyId);
    const document = await this.prisma.documentChantier.findFirst({
      where: { id: documentId, chantierId },
    });

    if (!document) {
      throw new NotFoundException(`Document #${documentId} introuvable.`);
    }

    await this.prisma.documentChantier.delete({ where: { id: documentId } });
    return { success: true, id: documentId };
  }

  async create(dto: CreateChantierDto, currentUser: CurrentUserPayload) {
    await this.ensureClientInCompany(dto.clientId, currentUser.companyId);

    if (dto.chefChantierId) {
      await this.ensureChefInCompany(dto.chefChantierId, currentUser.companyId);
    }

    const reference =
      dto.reference?.trim() ||
      (await this.generateReference(currentUser.companyId));

    return this.prisma.chantier.create({
      data: {
        companyId: currentUser.companyId,
        clientId: dto.clientId,
        chefChantierId: dto.chefChantierId,
        reference,
        adresse: dto.adresse,
        description: dto.description,
        statut: dto.statut,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        notes: dto.notes,
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        chefChantier: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async update(
    id: number,
    dto: UpdateChantierDto,
    currentUser: CurrentUserPayload,
  ) {
    const existing = await this.findOne(id, currentUser);

    if (dto.statut && dto.statut !== existing.statut) {
      this.workflowStateService.validateChantierTransition(existing.statut, dto.statut);
    }

    if (dto.clientId) {
      await this.ensureClientInCompany(dto.clientId, currentUser.companyId);
    }

    if (dto.chefChantierId) {
      await this.ensureChefInCompany(dto.chefChantierId, currentUser.companyId);
    }

    return this.prisma.chantier.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        chefChantierId: dto.chefChantierId,
        reference: dto.reference?.trim(),
        adresse: dto.adresse,
        description: dto.description,
        statut: dto.statut,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        notes: dto.notes,
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        chefChantier: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async getTaskAssignmentOptions(currentUser: CurrentUserPayload) {
    await this.ensureDefaultInterneEquipe(currentUser.companyId);

    const [sousTraitants, equipesInternes] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          companyId: currentUser.companyId,
          role: Role.SOUS_TRAITANT,
          actif: true,
        },
        select: { id: true, nom: true, prenom: true, email: true },
        orderBy: [{ prenom: 'asc' }, { nom: 'asc' }],
      }),
      this.prisma.equipe.findMany({
        where: {
          companyId: currentUser.companyId,
          type: 'INTERNE',
          actif: true,
        },
        select: { id: true, nom: true, type: true },
        orderBy: { nom: 'asc' },
      }),
    ]);

    return {
      sousTraitants,
      equipesInternes,
    };
  }

  async listTasks(chantierId: number, currentUser: CurrentUserPayload) {
    const chantier = await this.ensureChantierInCompany(
      chantierId,
      currentUser.companyId,
    );

    const tasks = await this.prisma.tache.findMany({
      where: { chantierId },
      orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
      include: {
        affectations: {
          select: {
            id: true,
            user: {
              select: { id: true, nom: true, prenom: true, email: true },
            },
            equipe: {
              select: { id: true, nom: true, type: true },
            },
          },
        },
      },
    });

    return {
      chantierId: chantier.id,
      chantierReference: chantier.reference,
      client: chantier.client,
      chantierStatutAuto: this.computeChantierAutoStatus(tasks),
      resumeTaches: this.buildTaskSummary(tasks),
      tasks: tasks.map((task) => this.mapTaskWithAssignment(task)),
    };
  }

  async createTask(
    chantierId: number,
    dto: CreateTacheDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureChantierInCompany(chantierId, currentUser.companyId);
    this.ensureTaskDateRange(dto.dateDebut, dto.dateFin);
    const assignment = await this.resolveTaskAssignment(
      dto,
      currentUser.companyId,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.tache.create({
        data: {
          chantierId,
          libelle: dto.libelle.trim(),
          description: dto.description?.trim() || undefined,
          dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
          dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
          statut: dto.done ? TacheStatut.TERMINEE : TacheStatut.A_FAIRE,
          avancement: dto.done ? 100 : 0,
          ordre: dto.ordre ?? 0,
        },
        select: { id: true },
      });

      if (assignment) {
        await tx.affectationTache.create({
          data: {
            tacheId: task.id,
            userId: assignment.userId ?? undefined,
            equipeId: assignment.equipeId ?? undefined,
          },
        });
      }

      return tx.tache.findUnique({
        where: { id: task.id },
        include: {
          affectations: {
            select: {
              id: true,
              user: {
                select: { id: true, nom: true, prenom: true, email: true },
              },
              equipe: {
                select: { id: true, nom: true, type: true },
              },
            },
          },
        },
      });
    });

    if (!created) {
      throw new NotFoundException('Tache creee mais introuvable.');
    }

    const taskStatusList = await this.prisma.tache.findMany({
      where: { chantierId },
      select: { statut: true, avancement: true, dateFin: true },
    });

    return {
      message: 'Tache creee.',
      task: this.mapTaskWithAssignment(created),
      chantierStatutAuto: this.computeChantierAutoStatus(taskStatusList),
      resumeTaches: this.buildTaskSummary(taskStatusList),
    };
  }

  async updateTask(
    chantierId: number,
    tacheId: number,
    dto: UpdateTacheDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureChantierInCompany(chantierId, currentUser.companyId);
    this.ensureTaskDateRange(dto.dateDebut, dto.dateFin);

    const existing = await this.prisma.tache.findFirst({
      where: {
        id: tacheId,
        chantierId,
        chantier: { companyId: currentUser.companyId },
      },
      select: {
        id: true,
        statut: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Tache #${tacheId} introuvable pour le chantier #${chantierId}.`,
      );
    }

    const data: Prisma.TacheUpdateInput = {};
    if (dto.libelle !== undefined) {
      data.libelle = dto.libelle.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.dateDebut !== undefined) {
      data.dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : null;
    }
    if (dto.dateFin !== undefined) {
      data.dateFin = dto.dateFin ? new Date(dto.dateFin) : null;
    }
    if (dto.ordre !== undefined) {
      data.ordre = dto.ordre;
    }
    if (dto.statut !== undefined) {
      data.statut = dto.statut;
      if (dto.statut === TacheStatut.TERMINEE) {
        data.avancement = 100;
      }
      if (dto.statut === TacheStatut.A_FAIRE && dto.done === undefined) {
        data.avancement = 0;
      }
    }
    if (dto.done !== undefined) {
      data.statut = dto.done ? TacheStatut.TERMINEE : TacheStatut.A_FAIRE;
      data.avancement = dto.done ? 100 : 0;
    } else if (
      dto.statut === undefined &&
      existing.statut === TacheStatut.TERMINEE
    ) {
      // Keep legacy TERMINEE tasks consistent when edited without explicit status.
      data.avancement = 100;
    }

    const shouldUpdateAssignment =
      dto.assigneeType !== undefined ||
      dto.sousTraitantId !== undefined ||
      dto.equipeId !== undefined;

    const assignment = shouldUpdateAssignment
      ? await this.resolveTaskAssignment(dto, currentUser.companyId)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tache.update({
        where: { id: tacheId },
        data,
      });

      if (shouldUpdateAssignment) {
        await tx.affectationTache.deleteMany({ where: { tacheId } });

        if (assignment) {
          await tx.affectationTache.create({
            data: {
              tacheId,
              userId: assignment.userId ?? undefined,
              equipeId: assignment.equipeId ?? undefined,
            },
          });
        }
      }

      return tx.tache.findUnique({
        where: { id: tacheId },
        include: {
          affectations: {
            select: {
              id: true,
              user: {
                select: { id: true, nom: true, prenom: true, email: true },
              },
              equipe: {
                select: { id: true, nom: true, type: true },
              },
            },
          },
        },
      });
    });

    if (!updated) {
      throw new NotFoundException(`Tache #${tacheId} introuvable.`);
    }

    const taskStatusList = await this.prisma.tache.findMany({
      where: { chantierId },
      select: { statut: true, avancement: true, dateFin: true },
    });

    return {
      message: 'Tache mise a jour.',
      task: this.mapTaskWithAssignment(updated),
      chantierStatutAuto: this.computeChantierAutoStatus(taskStatusList),
      resumeTaches: this.buildTaskSummary(taskStatusList),
    };
  }

  async removeTask(
    chantierId: number,
    tacheId: number,
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureChantierInCompany(chantierId, currentUser.companyId);

    const existing = await this.prisma.tache.findFirst({
      where: {
        id: tacheId,
        chantierId,
        chantier: { companyId: currentUser.companyId },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `Tache #${tacheId} introuvable pour le chantier #${chantierId}.`,
      );
    }

    await this.prisma.tache.delete({ where: { id: tacheId } });

    const taskStatusList = await this.prisma.tache.findMany({
      where: { chantierId },
      select: { statut: true, avancement: true, dateFin: true },
    });

    return {
      message: `Tache #${tacheId} supprimee.`,
      chantierStatutAuto: this.computeChantierAutoStatus(taskStatusList),
      resumeTaches: this.buildTaskSummary(taskStatusList),
    };
  }

  async remove(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    await this.prisma.$transaction(async (tx) => {
      await tx.affectationTache.deleteMany({
        where: {
          tache: {
            chantierId: id,
          },
        },
      });

      await tx.tache.deleteMany({ where: { chantierId: id } });
      await tx.documentChantier.deleteMany({ where: { chantierId: id } });
      await tx.devis.updateMany({
        where: { chantierId: id },
        data: { chantierId: null },
      });
      await tx.chantier.delete({ where: { id } });
    });

    return {
      message: `Chantier #${id} supprime.`,
    };
  }
}



