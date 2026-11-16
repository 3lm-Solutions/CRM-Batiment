import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { QueryCommandeFournisseurDto } from './dto/query-commande-fournisseur.dto.js';
import { UpdateCommandeFournisseurStatutDto } from './dto/update-commande-fournisseur-statut.dto.js';
import { PortailFournisseurService } from './portail-fournisseur.service.js';

@ApiTags('Portail fournisseur')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SOUS_TRAITANT)
@Controller('portail-fournisseur')
export class PortailFournisseurController {
  constructor(
    private readonly portailFournisseurService: PortailFournisseurService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Profil fournisseur connecte',
    description:
      "Retourne le fournisseur relie au compte SOUS_TRAITANT via l'email.",
  })
  @ApiResponse({ status: 200, description: 'Profil fournisseur retourne.' })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.portailFournisseurService.getMe(user);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Resume du portail fournisseur',
    description:
      'Retourne les KPI commandes et les derniers bons d achat assignes a ce fournisseur.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard fournisseur retourne.' })
  getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.portailFournisseurService.getDashboard(user);
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Liste des commandes fournisseur',
    description:
      'Retourne uniquement les commandes du fournisseur authentifie avec filtres et pagination.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginee des commandes.' })
  findOrders(
    @Query() query: QueryCommandeFournisseurDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.portailFournisseurService.findOrders(user, query);
  }

  @Get('orders/:id')
  @ApiOperation({
    summary: 'Detail d une commande fournisseur',
    description:
      'Retourne le detail d une commande avec ses lignes, son client, le chantier et l historique des receptions.',
  })
  @ApiResponse({ status: 200, description: 'Detail commande retourne.' })
  @ApiResponse({ status: 404, description: 'Commande introuvable.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.portailFournisseurService.findOne(id, user);
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary: 'Mettre a jour le suivi logistique d une commande',
    description:
      'Permet au fournisseur de confirmer la disponibilite, indiquer la livraison ou marquer la commande comme recue/cloturee.',
  })
  @ApiResponse({ status: 200, description: 'Statut commande mis a jour.' })
  @ApiResponse({ status: 404, description: 'Commande introuvable.' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommandeFournisseurStatutDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.portailFournisseurService.updateStatus(id, dto, user);
  }
}
