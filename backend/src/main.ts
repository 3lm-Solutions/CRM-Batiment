import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { type Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed later to verify WhatsApp (Meta) webhook signatures
  });

  configureApp(app);

  const config = app.get<ConfigService, ConfigService<Env, true>>(ConfigService);
  const port = config.get('APP_PORT', { infer: true });
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  // Swagger only outside production (no public map of the API)
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CRM Bâtiment — API')
      .setDescription(
        'API REST du CRM pour société de bâtiment.\n\n' +
          "**Authentification** : système fermé — seul l'Admin crée les comptes.\n" +
          'Utilisez le token JWT : `Authorization: Bearer <token>`.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 API démarrée : http://localhost:${port}/api/v1`);
  if (!isProd) logger.log(`📚 Swagger    : http://localhost:${port}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  // Without this, a startup error becomes an "unhandled promise rejection"
  console.error('❌ Échec du démarrage de l’API :', error);
  process.exit(1);
});
