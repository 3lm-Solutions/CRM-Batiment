import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { createRequestContextMiddleware } from './common/middleware/request-context.middleware';
import { validationExceptionFactory } from './common/validators/validation-messages';
import { type Env } from './config/env.validation';

/**
 * Global HTTP configuration, shared by main.ts AND the e2e tests,
 * so tests run against exactly the same setup as production.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService, ConfigService<Env, true>>(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const isProd = nodeEnv === 'production';
  const bodyLimit = config.get('BODY_LIMIT', { infer: true });

  // First: request ID + one log line per request (silent during tests)
  app.use(createRequestContextMiddleware({ log: nodeEnv !== 'test' }));

  // Security headers. CSP is relaxed outside production so Swagger UI loads.
  app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));

  // Base64 signatures exceed Express's 100kb default (old "413 Payload Too Large" bug)
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // All routes: /api/v1/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared in the DTO
      forbidNonWhitelisted: true, // ...and reject the request if there are any
      transform: true, // build real DTO class instances
      transformOptions: { enableImplicitConversion: true }, // "?page=2" -> 2
      exceptionFactory: validationExceptionFactory, // messages in French for the user
    }),
  );

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    exposedHeaders: ['X-Request-Id'], // readable by the frontend for error reports
  });

  // Clean shutdown: lets cron jobs and Prisma close properly (Step 2+)
  app.enableShutdownHooks();
}
