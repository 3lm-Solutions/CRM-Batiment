import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreateRagDocumentDto } from './dto/create-rag-document.dto.js';
import { UpdateRagDocumentDto } from './dto/update-rag-document.dto.js';
import { QueryRagDocumentsDto } from './dto/query-rag-documents.dto.js';

@Injectable()
export class RagService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRagDocumentDto, currentUser: CurrentUserPayload) {
    return this.prisma.ragDocument.create({
      data: {
        companyId: currentUser.companyId,
        titre: dto.titre.trim(),
        categorie: this.normalizeCategorie(dto.categorie),
        contenu: dto.contenu.trim(),
        actif: dto.actif ?? true,
        priorite: dto.priorite ?? 0,
      },
    });
  }

  async findAll(query: QueryRagDocumentsDto, currentUser: CurrentUserPayload) {
    const search = query.search?.trim();
    const categorie = query.categorie?.trim();

    return this.prisma.ragDocument.findMany({
      where: {
        companyId: currentUser.companyId,
        actif: query.actif,
        categorie: categorie
          ? { equals: this.normalizeCategorie(categorie), mode: 'insensitive' }
          : undefined,
        OR: search
          ? [
              { titre: { contains: search, mode: 'insensitive' } },
              { categorie: { contains: search, mode: 'insensitive' } },
              { contenu: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [
        { priorite: 'desc' },
        { updatedAt: 'desc' },
        { titre: 'asc' },
      ],
    });
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    const document = await this.prisma.ragDocument.findFirst({
      where: {
        id,
        companyId: currentUser.companyId,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document RAG #${id} non trouve`);
    }

    return document;
  }

  async update(
    id: number,
    dto: UpdateRagDocumentDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.findOne(id, currentUser);

    return this.prisma.ragDocument.update({
      where: { id },
      data: {
        titre: dto.titre?.trim(),
        categorie:
          dto.categorie !== undefined
            ? this.normalizeCategorie(dto.categorie)
            : undefined,
        contenu: dto.contenu?.trim(),
        actif: dto.actif,
        priorite: dto.priorite,
      },
    });
  }

  async remove(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    const deleted = await this.prisma.ragDocument.delete({
      where: { id },
    });

    return {
      message: 'Document RAG supprime.',
      documentId: deleted.id,
    };
  }

  private normalizeCategorie(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
  }
}
