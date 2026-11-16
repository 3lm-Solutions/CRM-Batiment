import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '../../../shared';
import { Public } from '../../../common/decorators/public.decorator';
import { type Env } from '../../../config/env.validation';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Vérifie que l'API et la base de données répondent" })
  @ApiOkResponse({ description: 'État de l’API' })
  async check(): Promise<HealthResponse> {
    const databaseUp = await this.prisma.isHealthy();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      environment: this.config.get('NODE_ENV', { infer: true }),
    };
  }
}
