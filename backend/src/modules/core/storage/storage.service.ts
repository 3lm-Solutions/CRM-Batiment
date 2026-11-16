import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { Env } from '../../../config/env.validation';

/**
 * Storage service:
 * - If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set: uses Supabase Object Storage (S3 / REST).
 * - Otherwise: falls back to local disk under STORAGE_DIR.
 *
 * Keys format: `<companyId>/<yyyy-mm>/<uuid>.<ext>`.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly supabaseUrl?: string;
  private readonly supabaseKey?: string;
  private readonly supabaseBucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
    const rawUrl = config.get('SUPABASE_URL', { infer: true });
    this.supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : undefined;
    this.supabaseKey = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    this.supabaseBucket = config.get('SUPABASE_BUCKET', { infer: true }) || 'crm-fichiers';
  }

  async onModuleInit() {
    if (this.supabaseUrl && this.supabaseKey) {
      this.logger.log(`Stockage cloud actif : Supabase Storage (bucket: ${this.supabaseBucket})`);
    } else {
      await mkdir(this.root, { recursive: true });
      this.logger.log(`Stockage local actif dans : ${this.root}`);
    }
  }

  async save(companyId: number, ext: string, data: Buffer): Promise<string> {
    const month = new Date().toISOString().slice(0, 7);
    const key = `${companyId}/${month}/${randomUUID()}.${ext}`;

    if (this.supabaseUrl && this.supabaseKey) {
      const url = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}/${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': this.mimeFor(ext),
          'x-upsert': 'false',
        },
        body: new Uint8Array(data),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Échec upload Supabase (${res.status}): ${err}`);
        throw new Error(`Erreur stockage Supabase (${res.status}): ${err}`);
      }

      return key;
    }

    const path = this.pathOf(key);
    await mkdir(resolve(path, '..'), { recursive: true });
    // 'wx': never overwrite (a UUID collision would throw instead of losing a file)
    await writeFile(path, data, { flag: 'wx' });
    return key;
  }

  async open(key: string): Promise<{ stream: Readable; size: number }> {
    if (this.supabaseUrl && this.supabaseKey) {
      const url = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}/${key}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      });

      if (!res.ok) {
        throw new NotFoundException('Fichier introuvable dans le stockage Supabase');
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { stream: Readable.from(buffer), size: buffer.length };
    }

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
    if (this.supabaseUrl && this.supabaseKey) {
      const url = `${this.supabaseUrl}/storage/v1/object/${this.supabaseBucket}`;
      try {
        await fetch(url, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefixes: [key] }),
        });
      } catch (error) {
        this.logger.warn(`Suppression impossible de ${key} sur Supabase: ${String(error)}`);
      }
      return;
    }

    try {
      await rm(this.pathOf(key), { force: true });
    } catch (error) {
      this.logger.warn(`Suppression impossible de ${key}: ${String(error)}`);
    }
  }

  private mimeFor(ext: string): string {
    switch (ext.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
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
