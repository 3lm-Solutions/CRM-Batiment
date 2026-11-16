import { Controller, Post, HttpCode, UseGuards } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { Roles } from './common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';

@ApiTags('Development')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dev')
export class DevController {
  constructor(private appService: AppService) {}

  @Post('seed')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Initialize database with test data (Dev only)',
    description:
      'Creates test users, companies, and sample data. NEVER use in production!',
  })
  async seed() {
    return this.appService.seedDatabase();
  }
}
