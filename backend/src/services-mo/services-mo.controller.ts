import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ServicesMoService } from './services-mo.service.js';
import { CreateServiceMoDto } from './dto/create-service-mo.dto.js';
import { UpdateServiceMoDto } from './dto/update-service-mo.dto.js';
import { QueryServiceMoDto } from './dto/query-service-mo.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags("Services Main d'Œuvre")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)//modifiee pour que les 3 roles puissent acceder aux services de main d'oeuvre
@Controller('services-mo')
export class ServicesMoController {
  constructor(private readonly servicesMoService: ServicesMoService) {}

  // ──────────────────────────────────────────────
  // POST /api/services-mo — Créer un service MO
  // ──────────────────────────────────────────────
  @Roles(Role.ADMIN)//ajoutée pour que seul l'admin puisse créer un service de main d'oeuvre
  @Post()
  @ApiOperation({
    summary: "Créer un service main d'œuvre (Admin)",
    description:
      "Ajoute un service de main d'œuvre à la bibliothèque de prix. Réservé aux admins.",
  })
  @ApiResponse({ status: 201, description: 'Service MO créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(
    @Body() dto: CreateServiceMoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.servicesMoService.create(dto, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/services-mo — Liste paginée + filtres
  // ──────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: "Liste des services main d'œuvre (Admin)",
    description:
      'Retourne la liste paginée des services MO. Filtrage par recherche et statut actif.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des services MO' })
  async findAll(
    @Query() query: QueryServiceMoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.servicesMoService.findAll(query, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/services-mo/:id — Détail d'un service MO
  // ──────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({ summary: "Détail d'un service main d'œuvre (Admin)" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Service MO trouvé' })
  @ApiResponse({ status: 404, description: 'Service MO non trouvé' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.servicesMoService.findOne(id, user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/services-mo/:id — Modifier un service MO
  // ──────────────────────────────────────────────
  @Roles(Role.ADMIN)//ajoutee pour que seul l'admin puisse modifier un service de main d'oeuvre
  @Patch(':id')
  @ApiOperation({ summary: "Modifier un service main d'œuvre (Admin)" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Service MO modifié' })
  @ApiResponse({ status: 404, description: 'Service MO non trouvé' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceMoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.servicesMoService.update(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/services-mo/:id — Supprimer un service MO
  // ──────────────────────────────────────────────
  @Roles(Role.ADMIN)//ajoutee pour que seul l'admin puisse supprimer un service de main d'oeuvre
  @Delete(':id')
  @ApiOperation({
    summary: "Supprimer un service main d'œuvre (Admin)",
    description: 'Désactive le service MO (soft delete).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Service MO désactivé' })
  @ApiResponse({ status: 404, description: 'Service MO non trouvé' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.servicesMoService.delete(id, user);
  }
}
