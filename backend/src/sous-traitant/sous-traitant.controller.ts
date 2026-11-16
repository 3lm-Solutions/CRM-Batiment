import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { SousTraitantService } from './sous-traitant.service.js';
import { UpdateTacheProgressDto } from './dto/update-tache-progress.dto.js';

@ApiTags('Sous-traitant Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SOUS_TRAITANT)
@Controller('sous-traitant')
export class SousTraitantController {
  constructor(private readonly sousTraitantService: SousTraitantService) {}

  @Get('profil')
  @ApiOperation({ summary: 'Consulter mon profil administratif' })
  async getProfil(@CurrentUser() user: CurrentUserPayload) {
    return this.sousTraitantService.getProfilLimite(user);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Tableau de bord Sous-traitant',
    description: 'Resume des chantiers et taches assignes.',
  })
  @ApiResponse({ status: 200, description: 'Resume du dashboard.' })
  async getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.sousTraitantService.getDashboard(user);
  }

  @Get('chantiers')
  @ApiOperation({
    summary: 'Chantiers assignes',
    description: 'Liste des chantiers assignes au Sous-traitant.',
  })
  @ApiResponse({ status: 200, description: 'Liste des chantiers.' })
  async getChantiersAssignes(@CurrentUser() user: CurrentUserPayload) {
    return this.sousTraitantService.getChantiersAssignes(user);
  }

  @Get('chantiers/:id')
  @ApiOperation({
    summary: 'Detail d un chantier',
    description: 'Recupere les details d un chantier assigne.',
  })
  @ApiResponse({ status: 200, description: 'Details du chantier.' })
  async getChantiersDetail(
    @Param('id', ParseIntPipe) chantierId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sousTraitantService.getChantiersDetail(chantierId, user);
  }

  @Get('chantiers/:id/documents')
  @ApiOperation({
    summary: 'Documents du chantier',
    description: 'Liste des documents disponibles pour ce chantier.',
  })
  @ApiResponse({ status: 200, description: 'Liste des documents.' })
  async getDocumentsChantier(
    @Param('id', ParseIntPipe) chantierId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sousTraitantService.getDocumentsChantier(chantierId, user);
  }

  @Get('taches')
  @ApiOperation({
    summary: 'Taches assignees',
    description: 'Liste des taches assignees au Sous-traitant.',
  })
  @ApiResponse({ status: 200, description: 'Liste des taches.' })
  async getTachesAssignees(@CurrentUser() user: CurrentUserPayload) {
    return this.sousTraitantService.getTachesAssignees(user);
  }

  @Get('taches/:id')
  @ApiOperation({ summary: 'Detail d une tache assignee' })
  async getTacheDetail(
    @Param('id', ParseIntPipe) tacheId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sousTraitantService.getTacheDetail(tacheId, user);
  }

  @Patch('taches/:id/progress')
  @ApiOperation({
    summary: 'Mettre a jour la progression d une tache',
    description:
      'Update le statut, l avancement et les commentaires d une tache.',
  })
  @ApiResponse({ status: 200, description: 'Tache mise a jour.' })
  async updateTacheProgress(
    @Param('id', ParseIntPipe) tacheId: number,
    @Body() updateDto: UpdateTacheProgressDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sousTraitantService.updateTacheProgress(
      tacheId,
      user,
      updateDto,
    );
  }
}
