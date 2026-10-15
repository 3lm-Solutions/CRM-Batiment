import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BusinessException, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { DashboardService } from './dashboard.service';

@ApiTags('Tableau de bord')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiQuery({ name: 'jours', required: false, description: 'Période d’analyse (défaut 30)' })
  @ApiOperation({ summary: 'Indicateurs : prospects, devis, conversion, CA, impayés, retards, commandes, marge, SAV, stock' })
  get(@CurrentUser() user: AuthUser, @Query('jours', new DefaultValuePipe(30), ParseIntPipe) jours: number) {
    if (jours < 1 || jours > 365) throw new BusinessException('PERIODE_INVALIDE', 'La période doit être entre 1 et 365 jours.');
    return this.dashboard.get(user, jours);
  }
}
