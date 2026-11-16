import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDemandeDevisDto } from './dto/create-demande-devis.dto.js';
import { UpdateDemandeDevisDto } from './dto/update-demande-devis.dto.js';
import { QueryDemandeDevisDto } from './dto/query-demande-devis.dto.js';
import { UpdateStatutDto } from './dto/update-statut.dto.js';
import type { DemandeStatut } from '../../generated/prisma/client.js';

/** Transitions de statut autorisées */
const TRANSITIONS_AUTORISEES: Record<string, string[]> = {
  NOUVEAU: ['EN_COURS', 'PERDU'],
  EN_COURS: ['CONVERTI', 'PERDU'],
  QUALIFIE: ['CONVERTI', 'PERDU'],
  CONVERTI: [],
  PERDU: [],
};

@Injectable()
export class DemandesDevisService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /* ───────── CREATE ───────── */
  async create(
    dto: CreateDemandeDevisDto,
    createurId: number,
    companyId: number,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
    });
    if (!client) {
      throw new NotFoundException(
        `Client #${dto.clientId} introuvable dans votre entreprise`,
      );
    }

    return this.prisma.demandeDevis.create({
      data: {
        companyId,
        clientId: dto.clientId,
        createurId,
        description: dto.description,
        source: dto.source,
        besoinStructure: dto.besoinStructure ?? undefined,
      },
      include: {
        client: true,
        createur: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  /* ───────── FIND ALL (paginated) ───────── */
  async findAll(query: QueryDemandeDevisDto, companyId: number) {
    const { page = 1, limit = 20, statut, clientId, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (statut) where.statut = statut;
    if (clientId) where.clientId = clientId;
    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.demandeDevis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          client: {
            select: { id: true, nom: true, prenom: true, telephone: true },
          },
          createur: { select: { id: true, nom: true, prenom: true } },
        },
      }),
      this.prisma.demandeDevis.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /* ───────── FIND ONE ───────── */
  async findOne(id: number, companyId: number) {
    const demande = await this.prisma.demandeDevis.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        createur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        devis: true,
      },
    });
    if (!demande) {
      throw new NotFoundException(`Demande de devis #${id} introuvable`);
    }
    return demande;
  }

  /* ───────── UPDATE ───────── */
  async update(id: number, dto: UpdateDemandeDevisDto, companyId: number) {
    const demande = await this.findOne(id, companyId);

    if (demande.statut === 'CONVERTI') {
      throw new ForbiddenException(
        'Impossible de modifier une demande déjà convertie en devis',
      );
    }

    return this.prisma.demandeDevis.update({
      where: { id },
      data: {
        description: dto.description,
        besoinStructure: dto.besoinStructure ?? undefined,
      },
      include: { client: true },
    });
  }

  /* ───────── UPDATE STATUT (workflow) ───────── */
  async updateStatut(
    id: number,
    dto: UpdateStatutDto,
    userId: number,
    companyId: number,
  ) {
    const demande = await this.findOne(id, companyId);

    const currentStatut = demande.statut as string;
    const newStatut = dto.statut as string;

    const allowed = TRANSITIONS_AUTORISEES[currentStatut] ?? [];
    if (!allowed.includes(newStatut)) {
      throw new BadRequestException(
        `Transition ${currentStatut} → ${newStatut} non autorisée. ` +
          `Transitions possibles : ${allowed.length ? allowed.join(', ') : 'aucune (statut final)'}`,
      );
    }

    if (newStatut === 'CONVERTI' && (demande.devis?.length ?? 0) === 0) {
      throw new BadRequestException(
        'Impossible de convertir la demande sans devis brouillon valide.',
      );
    }

    return this.prisma.demandeDevis.update({
      where: { id },
      data: { statut: newStatut as DemandeStatut },
      include: { client: true },
    });
  }

  /* ───────── CONVERTIR EN DEVIS ───────── */
  async convertirEnDevis(id: number, userId: number, companyId: number) {
    // 1. Récupérer la demande
    const demande = await this.findOne(id, companyId);

    // 2. Vérifications métier
    if (demande.statut === 'CONVERTI') {
      throw new BadRequestException(
        'Cette demande a déjà été convertie en devis',
      );
    }
    if (demande.statut === 'PERDU') {
      throw new BadRequestException(
        'Impossible de convertir une demande perdue',
      );
    }
    if (demande.devis && demande.devis.length > 0) {
      throw new BadRequestException(
        `Un devis existe déjà pour cette demande (ID: ${demande.devis[0].id})`,
      );
    }

    // 3. Générer référence unique DEV-2026-0001
    const annee = new Date().getFullYear();
    const count = await this.prisma.devis.count({ where: { companyId } });
    const reference = `DEV-${annee}-${String(count + 1).padStart(4, '0')}`;

    // 4. Créer le devis en BROUILLON
    const devis = await this.prisma.devis.create({
      data: {
        companyId,
        clientId: demande.clientId,
        demandeDevisId: demande.id,
        createurId: userId,
        reference,
        statut: 'BROUILLON',
        notes: `Généré depuis la demande #${demande.id} — ${demande.description}`,
      },
      include: { client: true, demandeDevis: true },
    });

    // 5. Créer une ligne initiale à partir de la description
    await this.prisma.ligneDevis.create({
      data: {
        devisId: devis.id,
        description: demande.description,
        quantite: 1,
        unite: 'FORFAIT',
        prixUnitaireVente: 0,
        prixAchat: 0,
        mainOeuvre: 0,
        totalHT: 0,
        coutTotal: 0,
        ordre: 1,
      },
    });

    // 6. Marquer la demande comme CONVERTI
    await this.prisma.demandeDevis.update({
      where: { id },
      data: { statut: 'CONVERTI' },
    });

    return {
      message: 'Demande convertie en devis avec succès',
      devisId: devis.id,
      reference: devis.reference,
      devis,
    };
  }

  /* ───────── DELETE ───────── */
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.demandeDevis.delete({ where: { id } });
  }

  async convertToDevis(id: number, userId: number, companyId: number) {
    return this.convertirEnDevis(id, userId, companyId);
  }
}