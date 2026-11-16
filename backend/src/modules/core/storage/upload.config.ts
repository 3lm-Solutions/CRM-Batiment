import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';

/** What multer hands to the controller (memory storage: the bytes are in `buffer`). */
export interface UploadedBinary {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Max photos per site report. */
export const MAX_PHOTOS_PER_RAPPORT = 10;

/**
 * Multer for every module with an upload route: files stay in memory (they are small and
 * written once by StorageService after their type is checked), size capped by UPLOAD_MAX_MB.
 * A bigger file is rejected by multer with 413 before reaching our code.
 */
export const UploadMulterModule = MulterModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({
    // No `storage` / `dest`: multer keeps the file in memory (`buffer`)
    limits: {
      fileSize: config.get('UPLOAD_MAX_MB', { infer: true }) * 1024 * 1024,
      files: MAX_PHOTOS_PER_RAPPORT,
      fields: 20,
    },
  }),
});
