import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { type Env } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * v2: PrismaService EXTENDS PrismaClient.
 *
 * The old version wrapped the client and re-declared ~50 getters by hand
 * (`get devis() { return this._client.devis }`...). Every new model needed a new getter,
 * and `$transaction` typing was lost (`as any`). Extending gives every model,
 * `$transaction`, `$queryRaw`... automatically, fully typed.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion PostgreSQL établie');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight connectivity check, used by /health. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
