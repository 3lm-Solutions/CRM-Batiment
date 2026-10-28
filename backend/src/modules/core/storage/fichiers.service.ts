import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { type AuthUser, BusinessException, BUREAU } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { ACCEPTED_LABEL, detectFileType, sanitizeFileName } from './file-type';
import { StorageService } from './storage.service';
import type { UploadedBinary } from './upload.config';

export const FICHIER_SELECT = { id: true, nom: true, mime: true, taille: true, createdAt: true } satisfies Prisma.FichierSelect;

export interface FichierLinks {
  chantierId?: number;
  rapportId?: number;
  /** Photo of an after-sales ticket (C42 of 21/10) */
  savTicketId?: number;
}

/**
 * Stored files: metadata in the database, bytes in StorageService.
 *
 * Read access (checked on EVERY download — files are never served as static content):
 *  - always same company;
 *  - a file of a job site (or of a site report) → whoever may see that job site:
 *    office, its chef de chantier, sous-traitant accounts given access;
 *  - a file attached to nothing job-site related (e.g. an insurance certificate) → office,
 *    chef de chantier, and the account that uploaded it;
 *  - a supplier only ever reads his own uploads.
 */
@Injectable()
export class FichiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Checks the real type, writes the bytes, then the row (bytes removed if the row fails). */
  async create(
    user: AuthUser,
    file: UploadedBinary | undefined,
    links: FichierLinks = {},
    db: DbClient = this.prisma,
    options: { imagesOnly?: boolean } = {},
  ) {
    return this.store(user.companyId, user.id, file, links, db, options);
  }

  /**
   * Same, for an upload without a user account (a client sending photos from his online space,
   * C42 of 21/10): `uploadedById` is null.
   */
  async store(
    companyId: number,
    uploadedById: number | null,
    file: UploadedBinary | undefined,
    links: FichierLinks = {},
    db: DbClient = this.prisma,
    options: { imagesOnly?: boolean } = {},
  ) {
    if (!file?.buffer?.length) throw new BusinessException('FICHIER_MANQUANT', 'Aucun fichier reçu.');
    const type = detectFileType(file.buffer);
    if (!type) throw new BusinessException('FICHIER_TYPE_REFUSE', `Format non accepté (${ACCEPTED_LABEL}).`);
    if (options.imagesOnly && !type.mime.startsWith('image/')) {
      throw new BusinessException('FICHIER_TYPE_REFUSE', 'Seules les photos sont acceptées (JPEG, PNG, WebP).');
    }

    if (links.chantierId) {
      const ok = await db.chantier.count({ where: { id: links.chantierId, companyId } });
      if (!ok) throw new BusinessException('CHANTIER_INTROUVABLE', `Chantier #${links.chantierId} introuvable.`);
    }

    const cle = await this.storage.save(companyId, type.ext, file.buffer);
    try {
      return await db.fichier.create({
        data: {
          companyId,
          cle,
          nom: sanitizeFileName(file.originalname, `fichier.${type.ext}`),
          mime: type.mime,
          taille: file.buffer.length,
          chantierId: links.chantierId,
          rapportId: links.rapportId,
          savTicketId: links.savTicketId,
          uploadedById,
        },
        select: FICHIER_SELECT,
      });
    } catch (error) {
      await this.storage.remove(cle);
      throw error;
    }
  }

  /** Streams a file whose access was checked by the caller (e.g. the client space, by its token). */
  async stream(fichier: { cle: string; mime: string; nom: string }): Promise<StreamableFile> {
    const { stream, size } = await this.storage.open(fichier.cle);
    return new StreamableFile(stream, {
      type: fichier.mime,
      length: size,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(fichier.nom)}`,
    });
  }

  async download(user: AuthUser, id: number): Promise<StreamableFile> {
    // inline: images / PDF open in the browser tab; the RFC 5987 form keeps accents
    return this.stream(await this.findReadable(user, id));
  }

  async meta(user: AuthUser, id: number) {
    const { cle: _cle, ...meta } = await this.findReadable(user, id);
    return meta;
  }

  /**
   * A file referenced by a document or a certificate must belong to the company and not be
   * attached elsewhere already. Used by chantier documents and insurance certificates.
   */
  async assertAttachable(user: AuthUser, fichierId: number, db: DbClient = this.prisma) {
    const fichier = await db.fichier.findFirst({
      where: { id: fichierId, companyId: user.companyId },
      include: { document: { select: { id: true } } },
    });
    if (!fichier) throw new BusinessException('FICHIER_INTROUVABLE', `Fichier #${fichierId} introuvable.`);
    if (fichier.document) throw new BusinessException('FICHIER_DEJA_UTILISE', 'Ce fichier est déjà joint à un document.');
    return fichier;
  }

  /** Deletes the row then the bytes. */
  async remove(id: number, db: DbClient = this.prisma): Promise<void> {
    const fichier = await db.fichier.findUnique({ where: { id }, select: { cle: true } });
    if (!fichier) return;
    await db.fichier.delete({ where: { id } });
    await this.storage.remove(fichier.cle);
  }

  // ── access ──────────────────────────────────────────────────────────────

  private async findReadable(user: AuthUser, id: number) {
    const fichier = await this.prisma.fichier.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        rapport: { select: { chantierId: true } },
        savTicket: { select: { assignedToId: true, chantier: { select: { chefChantierId: true } } } },
      },
    });
    // 404 rather than 403: never confirm that someone else's file exists
    if (!fichier || !(await this.canRead(user, fichier))) throw new NotFoundException(`Fichier #${id} introuvable`);
    const { rapport: _r, savTicket: _s, ...rest } = fichier;
    return rest;
  }

  private async canRead(
    user: AuthUser,
    f: {
      chantierId: number | null;
      uploadedById: number | null;
      rapport: { chantierId: number } | null;
      savTicket?: { assignedToId: number | null; chantier: { chefChantierId: number | null } | null } | null;
    },
  ): Promise<boolean> {
    if (BUREAU.includes(user.role)) return true;
    if (f.uploadedById === user.id) return true;
    if (user.role === Role.FOURNISSEUR) return false;

    // After-sales photo (C42): same scope as the ticket itself (a chef: assigned to it, or chef of its job site)
    if (f.savTicket) {
      return user.role === Role.CHEF_CHANTIER && (f.savTicket.assignedToId === user.id || f.savTicket.chantier?.chefChantierId === user.id);
    }

    const chantierId = f.chantierId ?? f.rapport?.chantierId ?? null;
    if (chantierId === null) return user.role === Role.CHEF_CHANTIER;

    const where: Prisma.ChantierWhereInput =
      user.role === Role.CHEF_CHANTIER
        ? { id: chantierId, chefChantierId: user.id }
        : { id: chantierId, sousTraitantsVisibles: { some: { userId: user.id } } };
    return (await this.prisma.chantier.count({ where })) > 0;
  }
}
