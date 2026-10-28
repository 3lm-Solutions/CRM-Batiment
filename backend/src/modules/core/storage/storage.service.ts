import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Env } from '../../../config/env.validation';

/**
 * Byte storage on the local disk, under STORAGE_DIR (outside git — see .gitignore — and
 * outside the database). Keys are generated here: `<companyId>/<yyyy-mm>/<uuid>.<ext>`;
 * nothing from the client (file name, path) ever reaches the file system.
 *
 * One small class on purpose: switching to S3 / object storage later means re-implementing
 * these four methods, nothing else changes.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
  }

  async onModuleInit() {
    await mkdir(this.root, { recursive: true });
    this.logger.log(`Fichiers stockés dans ${this.root}`);
  }

  async save(companyId: number, ext: string, data: Buffer): Promise<string> {
    const month = new Date().toISOString().slice(0, 7);
    const key = `${companyId}/${month}/${randomUUID()}.${ext}`;
    const path = this.pathOf(key);
    await mkdir(resolve(path, '..'), { recursive: true });
    // 'wx': never overwrite (a UUID collision would throw instead of losing a file)
    await writeFile(path, data, { flag: 'wx' });
    return key;
  }

  async open(key: string): Promise<{ stream: ReadStream; size: number }> {
    const path = this.pathOf(key);
    try {
      const { size } = await stat(path);
      return { stream: createReadStream(path), size };
    } catch {
      throw new NotFoundException('Fichier introuvable sur le disque');
    }
  }

  /** Best effort: a missing file is not an error (already removed). */
  async remove(key: string): Promise<void> {
    try {
      await rm(this.pathOf(key), { force: true });
    } catch (error) {
      this.logger.warn(`Suppression impossible de ${key}: ${String(error)}`);
    }
  }

  /** Resolves a key and refuses anything that would escape the storage root. */
  private pathOf(key: string): string {
    const path = resolve(join(this.root, key));
    const rel = relative(this.root, path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
      throw new NotFoundException('Fichier introuvable');
    }
    return path;
  }
}
