import { Controller, ForbiddenException, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeedService } from './seed.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';

@Controller('seed')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SeedController {
  constructor(
    private seedService: SeedService,
    private configService: ConfigService,
  ) {}

  @Post('init')
  @HttpCode(200)
  async init() {
    const env = this.configService.get<string>('APP_ENV') || 'development';
    if (env === 'production') {
      throw new ForbiddenException(
        'Le seeding de la base de donnees est desactive en production.',
      );
    }

    return await this.seedService.seedDatabase();
  }
}
