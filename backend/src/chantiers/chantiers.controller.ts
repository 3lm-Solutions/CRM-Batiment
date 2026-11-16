import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ChantiersService } from './chantiers.service.js';
import { CreateChantierDto } from './dto/create-chantier.dto.js';
import { CreateTacheDto } from './dto/create-tache.dto.js';
import { CreateDocumentChantierDto } from './dto/create-document-chantier.dto.js';
import { QueryChantierDto } from './dto/query-chantier.dto.js';
import { UpdateChantierDto } from './dto/update-chantier.dto.js';
import { UpdateTacheDto } from './dto/update-tache.dto.js';
import { UpdateChantierVisibilityDto } from './dto/update-chantier-visibility.dto.js';

@ApiTags('Chantiers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER, Role.TECHNICO, Role.SOUS_TRAITANT) // <-- AJOUTE
@Controller('chantiers')
export class ChantiersController {
  constructor(private readonly service: ChantiersService) {}

  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO) // <-- AJOUTE
  @Post('sync-from-devis')
  @ApiOperation({
    summary:
      'Generer les chantiers manquants depuis les devis deja acceptes/signes',
  })
  @ApiResponse({ status: 201, description: 'Synchronisation terminee.' })
  syncFromDevis(@CurrentUser() user: CurrentUserPayload) {
    return this.service.syncFromAcceptedDevis(user);
  }

  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)//ajoutee pour que les 3 roles puissent acceder a cette route
  @Post('refresh-descriptions-from-devis')
  @ApiOperation({
    summary:
      'Regenerer les descriptions des chantiers existants relies a un devis',
  })
  @ApiResponse({ status: 201, description: 'Descriptions regenerees.' })
  refreshDescriptionsFromDevis(@CurrentUser() user: CurrentUserPayload) {
    return this.service.refreshDescriptionsFromLinkedDevis(user);
  }

  @Roles(Role.ADMIN, Role.ASSISTANTE)//ajoutee pour que les 2 roles puissent acceder a cette route
  @Post()
  @ApiOperation({ summary: 'Creer un chantier' })
  @ApiResponse({ status: 201, description: 'Chantier cree.' })
  create(
    @Body() dto: CreateChantierDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les chantiers (pagination + recherche)' })
  @ApiResponse({ status: 200, description: 'Liste paginee retournee.' })
  findAll(
    @Query() query: QueryChantierDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.findAll(query, user);
  }

  @Get('assignation-options')
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @ApiOperation({
    summary:
      'Lister sous-traitants et equipes internes pour affectation des taches',
  })
  @ApiResponse({
    status: 200,
    description: 'Options d affectation retournees.',
  })
  getTaskAssignmentOptions(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getTaskAssignmentOptions(user);
  }

  @Get(':id/taches')
  //@Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER, Role.SOUS_TRAITANT)//ajoutee pour que les 3 roles puissent acceder a cette route
  @ApiOperation({ summary: 'Lister les taches d un chantier' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Liste des taches retournee.' })
  listTasks(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.listTasks(id, user);
  }

  @Post(':id/taches')
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Creer une tache pour un chantier' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Tache creee.' })
  createTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTacheDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.createTask(id, dto, user);
  }

  @Patch(':id/taches/:tacheId')
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Modifier une tache de chantier' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'tacheId', type: Number })
  updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Body() dto: UpdateTacheDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateTask(id, tacheId, dto, user);
  }

  @Delete(':id/taches/:tacheId')
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Supprimer une tache de chantier' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'tacheId', type: Number })
  removeTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.removeTask(id, tacheId, user);
  }

  @Post(':id/documents')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Ajouter un document à un chantier' })
  @ApiParam({ name: 'id', type: Number })
  createDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDocumentChantierDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.createDocument(id, dto, user);
  }

  @Delete(':id/documents/:documentId')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Supprimer un document d un chantier' })
  removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.removeDocument(id, documentId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail d un chantier' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Chantier retourne.' })
  @ApiResponse({ status: 404, description: 'Chantier introuvable.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/sous-traitants')
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  updateVisibility(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChantierVisibilityDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateVisibility(id, dto.sousTraitantIds, user);
  }

  @Patch(':id/plan-2d')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  savePlan2d(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { plan2d: Record<string, unknown>; imageDataUrl?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const plan2d = body.plan2d;
    if (!plan2d || typeof plan2d !== 'object') {
      throw new BadRequestException('Le plan 2D est vide ou invalide.');
    }
    return this.service.savePlan2d(id, plan2d, user, body.imageDataUrl);
  }

  @Delete(':id/plan-2d')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Supprimer le plan 2D du chantier' })
  @ApiParam({ name: 'id', type: Number })
  removePlan2d(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.removePlan2d(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)//ajoutee pour que les 3 roles puissent acceder a cette route
  @ApiOperation({ summary: 'Modifier un chantier' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChantierDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)//ajoutee pour que que le role admin puisse acceder a cette route
  @ApiOperation({ summary: 'Supprimer un chantier' })
  @ApiParam({ name: 'id', type: Number })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.remove(id, user);
  }
}
