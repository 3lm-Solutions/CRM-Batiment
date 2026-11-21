import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * Serverless entry (Vercel Functions): same app as main.ts, but without listen().
 * The Nest app is created once per warm instance and reused between requests.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Promise<Handler> | undefined;

async function createHandler(): Promise<Handler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cached ??= createHandler().catch((error: unknown) => {
    cached = undefined; // retry on next request instead of staying broken
    throw error;
  });
  const express = await cached;
  express(req, res);
}
