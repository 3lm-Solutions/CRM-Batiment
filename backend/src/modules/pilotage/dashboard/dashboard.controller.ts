import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type AuthUser,
  BUREAU,
  BusinessException,
  CurrentUser,
  Roles,
  STAFF,
} from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { DashboardMobileService } from './dashboard-mobile.service';
import { DashboardService } from './dashboard.service';

@ApiTags('Tableau de bord')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly mobile: DashboardMobileService,
  ) {}

  @Get()
  @ApiQuery({ name: 'jours', required: false, description: 'Période d’analyse (défaut 30)' })
  @ApiOperation({
    summary:
      'Indicateurs : prospects, devis, conversion, CA, impayés, retards, commandes, marge, SAV, stock',
  })
  get(
    @CurrentUser() user: AuthUser,
    @Query('jours', new DefaultValuePipe(30), ParseIntPipe) jours: number,
  ) {
    if (jours < 1 || jours > 365)
      throw new BusinessException('PERIODE_INVALIDE', 'La période doit être entre 1 et 365 jours.');
    return this.dashboard.get(user, jours);
  }

  // ── mobile app (16/11, lot B1) ──────────────────────────────────────────

  @Roles(...STAFF)
  @Get('chef')
  @ApiOperation({
    summary:
      'Exécution : chantiers du jour, tâches en retard, livraisons attendues, SAV ouverts (chef : ses chantiers)',
  })
  chef(@CurrentUser() user: AuthUser) {
    return this.mobile.chef(user);
  }

  @Roles(...BUREAU)
  @Get('commercial')
  @ApiQuery({ name: 'jours', required: false, description: 'Période de la conversion (défaut 30)' })
  @ApiQuery({ name: 'moi', required: false, description: 'Seulement mes devis / prospects' })
  @ApiOperation({
    summary: 'Commercial : prospects, devis en cours, à relancer, conversion, CA signé du mois',
  })
  commercial(
    @CurrentUser() user: AuthUser,
    @Query('jours', new DefaultValuePipe(30), ParseIntPipe) jours: number,
    @Query('moi', new DefaultValuePipe(false), ParseBoolPipe) moi: boolean,
  ) {
    if (jours < 1 || jours > 365)
      throw new BusinessException('PERIODE_INVALIDE', 'La période doit être entre 1 et 365 jours.');
    return this.mobile.commercial(user, jours, moi);
  }
}
