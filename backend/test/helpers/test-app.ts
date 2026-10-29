import type { Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { buildJwtPayload } from '../../src/common';
import {
  MAIL_TRANSPORT,
  type MailMessage,
  type MailTransport,
} from '../../src/modules/core/mail/mail.transport';
import { PrismaService } from '../../src/prisma/prisma.service';

/** Seeded demo accounts (prisma/seed/index.ts). */
export const SEED = {
  admin: 'admin@batiment-pro.fr',
  technico: 'technico@batiment-pro.fr',
  assistante: 'assistante@batiment-pro.fr',
  chef: 'chef@batiment-pro.fr',
  sousTraitant: 'soustraitant@batiment-pro.fr',
  fournisseur: 'fournisseur@batiment-pro.fr',
} as const;

/** Captures every email instead of sending it. */
export class CapturingMailTransport implements MailTransport {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  lastTo(to: string): MailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to === to);
  }
}

export interface TestApp {
  app: NestExpressApplication;
  http: App;
  prisma: PrismaService;
  mail: CapturingMailTransport;
  /** Valid session token for a seeded (or any existing) user, read from the database. */
  tokenFor(email: string): Promise<string>;
  close(): Promise<void>;
}

/** `overrides`: replace providers (e.g. a fake AI client) — `{ provide: TOKEN, useValue: fake }`. */
export async function createTestApp(
  extraControllers: Type[] = [],
  overrides: { provide: unknown; useValue: unknown }[] = [],
): Promise<TestApp> {
  const mail = new CapturingMailTransport();

  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail);
  for (const o of overrides) builder.overrideProvider(o.provide).useValue(o.useValue);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  return {
    app,
    http: app.getHttpServer() as App,
    prisma,
    mail,
    async tokenFor(email: string) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      return jwt.sign(buildJwtPayload(user));
    },
    close: () => app.close(),
  };
}
