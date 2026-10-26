import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { QueryRelancesDto, UpdateRelancesReglagesDto } from './relances.dto';
import { RelancesService } from './relances.service';

/** Reminders of quotes with no answer and unpaid invoices (C3 of 21/10). */
@ApiTags('Relances')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller()
export class RelancesController {
  constructor(private readonly relances: RelancesService) {}

  @Get('relances')
  @ApiOperation({ summary: 'Historique des relances d’un devis (?devisId=) ou d’une facture (?factureId=)' })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryRelancesDto) {
    return this.relances.liste(user, query);
  }

  @Post('devis/:id/relancer')
  @ApiOperation({ summary: 'Relancer le client maintenant (nouveau lien + email de rappel)' })
  relancerDevis(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.relances.relancerDevis(user, id);
  }

  @Post('factures/:id/relancer')
  @ApiOperation({ summary: 'Relancer le client maintenant (email de rappel de paiement)' })
  relancerFacture(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.relances.relancerFacture(user, id);
  }

  @Roles(Role.ADMIN)
  @Get('relances/reglages')
  reglages(@CurrentUser() user: AuthUser) {
    return this.relances.reglages(user);
  }

  @Roles(Role.ADMIN)
  @Patch('relances/reglages')
  updateReglages(@CurrentUser() user: AuthUser, @Body() dto: UpdateRelancesReglagesDto) {
    return this.relances.updateReglages(user, dto);
  }

  @Roles(Role.ADMIN)
  @Post('relances/executer') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lancer les relances automatiques maintenant (sinon : chaque jour à 8 h)' })
  executer(@CurrentUser() user: AuthUser) {
    return this.relances.executer(user.companyId);
  }
}
