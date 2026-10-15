import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, paginate, toSkipTake } from '../../../common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateConnaissanceDto, QueryConnaissancesDto, UpdateConnaissanceDto } from './dto/connaissances.dto';

export interface Connaissance {
  id: number;
  titre: string;
  categorie: string;
  contenu: string;
  rank: number;
}

/**
 * Knowledge base (RagDocument) + search with PostgreSQL full-text search, french configuration
 * (stemming: "isoler" finds "isolation"). Good enough for a few hundred documents per company;
 * an expression index can be added later (docs/assistant.md).
 */
@Injectable()
export class ConnaissancesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Words of a question → "mot1:* | mot2:*" (OR, prefix). Only letters/digits reach SQL. */
  static toTsQuery(text: string): string | null {
    const words = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].slice(0, 12);
    return words.length ? words.map((w) => `${w}:*`).join(' | ') : null;
  }

  async search(companyId: number, text: string, limit = 4): Promise<Connaissance[]> {
    const query = ConnaissancesService.toTsQuery(text);
    if (!query) return [];
    // Parameters are bound by Prisma ($queryRaw tagged template): no SQL injection possible
    return this.prisma.$queryRaw<Connaissance[]>`
      SELECT id, titre, categorie, contenu,
             (ts_rank(to_tsvector('french', titre || ' ' || contenu), to_tsquery('french', ${query}))
               + priorite * 0.05)::float8 AS rank
      FROM rag_documents
      WHERE "companyId" = ${companyId}
        AND actif = true
        AND to_tsvector('french', titre || ' ' || contenu) @@ to_tsquery('french', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}`;
  }

  // ── CRUD (back-office) ──────────────────────────────────────────────────

  async findAll(user: AuthUser, query: QueryConnaissancesDto) {
    const where: Prisma.RagDocumentWhereInput = {
      companyId: user.companyId,
      categorie: query.categorie,
      actif: query.actif,
      ...(query.search && {
        OR: [{ titre: { contains: query.search, mode: 'insensitive' } }, { contenu: { contains: query.search, mode: 'insensitive' } }],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.ragDocument.findMany({ where, orderBy: [{ priorite: 'desc' }, { titre: 'asc' }], ...toSkipTake(query) }),
      this.prisma.ragDocument.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async categories(user: AuthUser) {
    const rows = await this.prisma.ragDocument.groupBy({ by: ['categorie'], where: { companyId: user.companyId }, _count: { _all: true }, orderBy: { categorie: 'asc' } });
    return rows.map((r) => ({ categorie: r.categorie, nombre: r._count._all }));
  }

  create(user: AuthUser, dto: CreateConnaissanceDto) {
    return this.prisma.ragDocument.create({ data: { ...dto, companyId: user.companyId } });
  }

  async update(user: AuthUser, id: number, dto: UpdateConnaissanceDto) {
    await this.assertExists(user, id);
    return this.prisma.ragDocument.update({ where: { id }, data: dto });
  }

  async remove(user: AuthUser, id: number) {
    await this.assertExists(user, id);
    await this.prisma.ragDocument.delete({ where: { id } });
  }

  private async assertExists(user: AuthUser, id: number) {
    const ok = await this.prisma.ragDocument.count({ where: { id, companyId: user.companyId } });
    if (!ok) throw new NotFoundException(`Document #${id} introuvable`);
  }
}
