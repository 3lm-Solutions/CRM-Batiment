import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Préfixe global pour toutes les routes : /api
  app.setGlobalPrefix('api');

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // Rejette les requêtes avec des champs inconnus
      transform: true, // Transforme les types automatiquement
    }),
  );

  // CORS (autorise le frontend React en dev)
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    credentials: true,
  });
  // Swagger (documentation API interactive)
  const config = new DocumentBuilder()
    .setTitle('CRM Bâtiment — API')
    .setDescription(
      'API REST du CRM pour société de bâtiment.\n\n' +
        "**Authentification** : Système fermé — seul l'Admin crée les comptes.\n" +
        'Utilisez le token JWT dans le header `Authorization: Bearer <token>`.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag(
      'Authentification',
      'Login, changement de mot de passe, création de compte',
    )
    .addTag('Utilisateurs', 'CRUD utilisateurs (Admin uniquement)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['APP_PORT'] ?? 3000;
  await app.listen(port);

  console.log(`\n🚀 CRM Bâtiment API démarrée sur http://localhost:${port}`);
  console.log(`📚 Swagger docs : http://localhost:${port}/api/docs\n`);
}
bootstrap();
