import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateSousTraitantDto, UpdateSousTraitantDto,
  CreateContratSousTraitantDto, UpdateContratSousTraitantDto,
  CreateAssuranceSousTraitantDto, UpdateAssuranceSousTraitantDto,
  CreatePaiementSousTraitantDto, UpdatePaiementSousTraitantDto,
  CreateDisponibiliteSousTraitantDto, UpdateDisponibiliteSousTraitantDto,
  CreateNotationSousTraitantDto, UpdateNotationSousTraitantDto
} from './dto/sous-traitants.dto.js';

@Injectable()
export class SousTraitantsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // 1. SOUS-TRAITANT CRUD
  // ==========================================

  async createSousTraitant(dto: CreateSousTraitantDto, companyId: number) {
    return this.prisma.sousTraitant.create({
      data: { ...dto, companyId },
    });
  }

  async findAllSousTraitants(companyId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.sousTraitant.findMany({
        where: { companyId },
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
      }),
      this.prisma.sousTraitant.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneSousTraitant(id: number, companyId: number) {
    const record = await this.prisma.sousTraitant.findFirst({
      where: { id, companyId },
    });
    if (!record) throw new NotFoundException(`SousTraitant #${id} introuvable`);
    return record;
  }

  async updateSousTraitant(id: number, dto: UpdateSousTraitantDto, companyId: number) {
    await this.findOneSousTraitant(id, companyId);
    return this.prisma.sousTraitant.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSousTraitant(id: number, companyId: number) {
    await this.findOneSousTraitant(id, companyId);
    return this.prisma.sousTraitant.delete({
      where: { id },
    });
  }

  // ==========================================
  // 2. CONTRAT CRUD
  // ==========================================

  async createContrat(dto: CreateContratSousTraitantDto, companyId: number) {
    await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    
    const chantier = await this.prisma.chantier.findFirst({
      where: { id: dto.chantierId, companyId },
    });
    if (!chantier) {
      throw new NotFoundException(`Chantier #${dto.chantierId} introuvable`);
    }

    try {
      return await this.prisma.contratSousTraitant.create({
        data: {
          ...dto,
          companyId,
          dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : null,
          dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Un contrat avec la reference "${dto.reference}" existe deja.`);
      }
      throw error;
    }
  }

  async findAllContrats(companyId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.contratSousTraitant.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: {
          sousTraitant: true,
          chantier: {
            include: {
              client: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contratSousTraitant.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneContrat(id: number, companyId: number) {
    const record = await this.prisma.contratSousTraitant.findFirst({
      where: { id, companyId },
      include: {
        sousTraitant: true,
        chantier: {
          include: {
            client: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundException(`Contrat #${id} introuvable`);
    return record;
  }

  async updateContrat(id: number, dto: UpdateContratSousTraitantDto, companyId: number) {
    await this.findOneContrat(id, companyId);
    if (dto.sousTraitantId) {
      await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    }
    try {
      return await this.prisma.contratSousTraitant.update({
        where: { id },
        data: {
          ...dto,
          dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
          dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Un contrat avec la reference "${dto.reference}" existe deja.`);
      }
      throw error;
    }
  }

  async deleteContrat(id: number, companyId: number) {
    await this.findOneContrat(id, companyId);
    return this.prisma.contratSousTraitant.delete({
      where: { id },
    });
  }

  // ==========================================
  // 3. ASSURANCE CRUD
  // ==========================================

  async createAssurance(dto: CreateAssuranceSousTraitantDto, companyId: number) {
    await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    return this.prisma.assuranceSousTraitant.create({
      data: {
        ...dto,
        companyId,
        dateExpiration: new Date(dto.dateExpiration),
      },
    });
  }

  async findAllAssurances(companyId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.assuranceSousTraitant.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: { sousTraitant: true },
        orderBy: { dateExpiration: 'asc' },
      }),
      this.prisma.assuranceSousTraitant.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneAssurance(id: number, companyId: number) {
    const record = await this.prisma.assuranceSousTraitant.findFirst({
      where: { id, companyId },
      include: { sousTraitant: true },
    });
    if (!record) throw new NotFoundException(`Assurance #${id} introuvable`);
    return record;
  }

  async updateAssurance(id: number, dto: UpdateAssuranceSousTraitantDto, companyId: number) {
    await this.findOneAssurance(id, companyId);
    if (dto.sousTraitantId) {
      await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    }
    return this.prisma.assuranceSousTraitant.update({
      where: { id },
      data: {
        ...dto,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : undefined,
      },
    });
  }

  async deleteAssurance(id: number, companyId: number) {
    await this.findOneAssurance(id, companyId);
    return this.prisma.assuranceSousTraitant.delete({
      where: { id },
    });
  }

  // ==========================================
  // 4. PAIEMENT CRUD
  // ==========================================

  async createPaiement(dto: CreatePaiementSousTraitantDto, companyId: number) {
    await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    if (dto.contratId) {
      await this.findOneContrat(dto.contratId, companyId);
    }
    return this.prisma.paiementSousTraitant.create({
      data: {
        ...dto,
        companyId,
        datePaiement: new Date(dto.datePaiement),
      },
    });
  }

  async findAllPaiements(companyId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.paiementSousTraitant.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: { sousTraitant: true, contrat: true },
        orderBy: { datePaiement: 'desc' },
      }),
      this.prisma.paiementSousTraitant.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOnePaiement(id: number, companyId: number) {
    const record = await this.prisma.paiementSousTraitant.findFirst({
      where: { id, companyId },
      include: { sousTraitant: true, contrat: true },
    });
    if (!record) throw new NotFoundException(`Paiement #${id} introuvable`);
    return record;
  }

  async updatePaiement(id: number, dto: UpdatePaiementSousTraitantDto, companyId: number) {
    await this.findOnePaiement(id, companyId);
    if (dto.sousTraitantId) {
      await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    }
    if (dto.contratId) {
      await this.findOneContrat(dto.contratId, companyId);
    }
    return this.prisma.paiementSousTraitant.update({
      where: { id },
      data: {
        ...dto,
        datePaiement: dto.datePaiement ? new Date(dto.datePaiement) : undefined,
      },
    });
  }

  async deletePaiement(id: number, companyId: number) {
    await this.findOnePaiement(id, companyId);
    return this.prisma.paiementSousTraitant.delete({
      where: { id },
    });
  }

  // ==========================================
  // 5. DISPONIBILITE CRUD
  // ==========================================

  async createDisponibilite(dto: CreateDisponibiliteSousTraitantDto, companyId: number) {
    await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    return this.prisma.disponibiliteSousTraitant.create({
      data: {
        ...dto,
        companyId,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
      },
    });
  }

  async findAllDisponibilites(companyId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.disponibiliteSousTraitant.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: { sousTraitant: true },
        orderBy: { dateDebut: 'asc' },
      }),
      this.prisma.disponibiliteSousTraitant.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneDisponibilite(id: number, companyId: number) {
    const record = await this.prisma.disponibiliteSousTraitant.findFirst({
      where: { id, companyId },
      include: { sousTraitant: true },
    });
    if (!record) throw new NotFoundException(`Disponibilite #${id} introuvable`);
    return record;
  }

  async updateDisponibilite(id: number, dto: UpdateDisponibiliteSousTraitantDto, companyId: number) {
    await this.findOneDisponibilite(id, companyId);
    if (dto.sousTraitantId) {
      await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    }
    return this.prisma.disponibiliteSousTraitant.update({
      where: { id },
      data: {
        ...dto,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
      },
    });
  }

  async deleteDisponibilite(id: number, companyId: number) {
    await this.findOneDisponibilite(id, companyId);
    return this.prisma.disponibiliteSousTraitant.delete({
      where: { id },
    });
  }

  // ==========================================
  // 6. NOTATION CRUD
  // ==========================================

  async createNotation(dto: CreateNotationSousTraitantDto, companyId: number) {
    await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    return this.prisma.notationSousTraitant.create({
      data: { ...dto, companyId },
    });
  }

  async findAllNotations(companyId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notationSousTraitant.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: { sousTraitant: true, chantier: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notationSousTraitant.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneNotation(id: number, companyId: number) {
    const record = await this.prisma.notationSousTraitant.findFirst({
      where: { id, companyId },
      include: { sousTraitant: true, chantier: true },
    });
    if (!record) throw new NotFoundException(`Notation #${id} introuvable`);
    return record;
  }

  async updateNotation(id: number, dto: UpdateNotationSousTraitantDto, companyId: number) {
    await this.findOneNotation(id, companyId);
    if (dto.sousTraitantId) {
      await this.findOneSousTraitant(dto.sousTraitantId, companyId);
    }
    return this.prisma.notationSousTraitant.update({
      where: { id },
      data: dto,
    });
  }

  async deleteNotation(id: number, companyId: number) {
    await this.findOneNotation(id, companyId);
    return this.prisma.notationSousTraitant.delete({
      where: { id },
    });
  }
}
