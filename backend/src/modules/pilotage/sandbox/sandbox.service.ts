import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { SessionResponse } from '../../../shared';
import { type Env, isDemoDatabase } from '../../../config/env.validation';
import { seedConnaissances } from '../../../database/seed/assistant';
import { seedCatalogue } from '../../../database/seed/catalogue';
import {
  seedCompany,
  seedPortalProfiles,
  seedTypesProjet,
  seedUsers,
  USERS,
} from '../../../database/seed/core';
import type { Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../../core/auth/auth.service';
import { DemoScenario } from './demo-scenario';

/**
 * Step 15 — demo sandbox. Runs on a SEPARATE instance (DEMO_MODE=true, database named *demo*):
 *  - visitors open a session for any role in one click, without a password;
 *  - every night at 03:00 (Paris) the whole database is wiped and re-seeded with sample data;
 *  - emails are never sent (MailModule prints them).
 * Never enabled on the real CRM: env validation refuses DEMO_MODE on a database not named *demo*.
 */
@Injectable()
export class SandboxService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SandboxService.name);
  private resetting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly auth: AuthService,
    private readonly scenario: DemoScenario,
  ) {}

  get enabled(): boolean {
    return this.config.get('DEMO_MODE', { infer: true });
  }

  /** First start of a demo instance on an empty database: load everything. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled || process.env.CRM_CLI) return;
    if ((await this.prisma.company.count()) === 0) {
      this.logger.log('Base de démo vide : chargement des données…');
      await this.reset().catch((e: unknown) =>
        this.logger.error('Chargement de la démo échoué', e instanceof Error ? e.stack : String(e)),
      );
    }
  }

  @Cron('0 3 * * *', { name: 'demo-reset', timeZone: 'Europe/Paris' })
  async nightly(): Promise<void> {
    if (!this.enabled) return;
    await this.reset().catch((e: unknown) =>
      this.logger.error(
        'Réinitialisation de la démo échouée',
        e instanceof Error ? e.stack : String(e),
      ),
    );
  }

  /** Wipes the WHOLE database and uploaded files, then reloads the demo data. */
  async reset(): Promise<string[]> {
    const url = this.config.get('DATABASE_URL', { infer: true });
    if (!this.enabled || !isDemoDatabase(url)) {
      throw new ForbiddenException(
        'Réinitialisation refusée : réservée à une instance de démo (DEMO_MODE=true, base « …demo… »).',
      );
    }
    if (this.resetting) throw new ConflictException('Réinitialisation déjà en cours.');
    this.resetting = true;
    const start = Date.now();
    try {
      await this.wipeDatabase();
      await this.wipeStorage();
      const resume = await this.seedAll();
      this.logger.log(`Démo réinitialisée en ${((Date.now() - start) / 1000).toFixed(1)} s`);
      return resume;
    } finally {
      this.resetting = false;
    }
  }

  /** Development: adds the sample clients, quotes, job sites… to the current database. */
  async loadExamples(): Promise<string[]> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production' && !this.enabled) {
      throw new ForbiddenException('Données d’exemple refusées en production.');
    }
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN', actif: true },
      orderBy: { id: 'asc' },
    });
    if (!admin) return ['Aucun compte ADMIN : lancez d’abord pnpm db:seed.'];
    return this.scenario.load(admin.companyId);
  }

  /** One-click session for a demo role. */
  async connexion(role: Role): Promise<SessionResponse> {
    if (!this.enabled) throw new NotFoundException();
    const seed = USERS.find((u) => u.role === role);
    if (!seed) throw new BadRequestException('Rôle inconnu');

    const user =
      (await this.prisma.user.findUnique({ where: { email: seed.email } })) ??
      (await this.prisma.user.findFirst({ where: { role }, orderBy: { id: 'asc' } }));
    if (!user || this.resetting) {
      throw new ServiceUnavailableException(
        'La démo est en cours de réinitialisation : réessayez dans une minute.',
      );
    }
    // A visitor may have deactivated or modified the shared account: put it back
    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { actif: true, role: seed.role, mustChangePassword: false, lastLoginAt: new Date() },
    });
    return this.auth.createSession(fresh);
  }

  info() {
    return {
      actif: this.enabled,
      reinitialisation: 'Chaque nuit à 3 h (heure de Paris)',
      comptes: USERS.map((u) => ({ role: u.role, nom: `${u.prenom} ${u.nom}` })),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async seedAll(): Promise<string[]> {
    const company = await seedCompany(this.prisma);
    const users = await seedUsers(this.prisma, company.id);
    await seedPortalProfiles(this.prisma, company.id, users);
    await seedTypesProjet(this.prisma, company.id);
    await seedCatalogue(this.prisma, company.id);
    await seedConnaissances(this.prisma, company.id);
    return [
      'Entreprise, 6 comptes, catalogue, base de connaissances',
      ...(await this.scenario.load(company.id)),
    ];
  }

  /** Every table except Prisma's migration history, ids restarted at 1. */
  private async wipeDatabase(): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
    if (!rows.length) return;
    const tables = rows.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(', ');
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }

  private async wipeStorage(): Promise<void> {
    const root = resolve(this.config.get('STORAGE_DIR', { infer: true }));
    const entries = await readdir(root).catch(() => [] as string[]);
    for (const entry of entries) await rm(join(root, entry), { recursive: true, force: true });
  }
}
