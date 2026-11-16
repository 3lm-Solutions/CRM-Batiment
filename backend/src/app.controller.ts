import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { Roles } from './common/decorators/roles.decorator.js';
import { CurrentUser } from './common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from './common/interfaces/jwt-payload.interface.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /dashboard/stats — KPIs P0 pour le Dashboard Admin
  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getDashboardStats(@CurrentUser() user: CurrentUserPayload) {
    return this.appService.getDashboardStats(user);
  }
}