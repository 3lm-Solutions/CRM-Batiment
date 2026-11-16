/**
 * Command-line tasks that need the whole application (services, workflow, events).
 *
 *   pnpm demo:exemples   adds sample clients, quotes, job sites… to the current database (dev)
 *   pnpm demo:reset      DEMO instance only: wipes the database and reloads the demo
 */
process.env.CRM_CLI = '1';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SandboxService } from './modules/pilotage/sandbox/sandbox.service';

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'exemples' && command !== 'reset') {
    console.log('Usage : node dist-cli/cli.js <exemples|reset>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const sandbox = app.get(SandboxService);
    const resume = command === 'reset' ? await sandbox.reset() : await sandbox.loadExamples();
    for (const line of resume) console.log(`✅ ${line}`);
  } catch (error) {
    new Logger('CLI').error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
