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
import { MateriauxService } from './materiaux.service.js';
import { CreateMateriauDto } from './dto/create-materiau.dto.js';
import { UpdateMateriauDto } from './dto/update-materiau.dto.js';
import { QueryMateriauDto } from './dto/query-materiau.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Matériaux')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)//avant ; Role.ADMIN => j'ai remplacé par ADMIN, TECHNICO, ASSISTANTE pour que les 3 roles puissent acceder aux materiaux
@Controller('materiaux')
export class MateriauxController {
  constructor(private readonly materiauxService: MateriauxService) {}

  // ──────────────────────────────────────────────
  // POST /api/materiaux — Créer un matériau
  // ──────────────────────────────────────────────

  @Roles(Role.ADMIN)// ajoutée pour que seul l'admin puisse créer un matériau
  @Post()
  @ApiOperation({
    summary: 'Créer un matériau (Admin)',
    description:
      "Ajoute un matériau à la bibliothèque de prix d'achat. Réservé aux admins.",
  })
  @ApiResponse({ status: 201, description: 'Matériau créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(
    @Body() dto: CreateMateriauDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.materiauxService.create(dto, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/materiaux — Liste paginée + filtres
  // ──────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Liste des matériaux',
    description:
      'Retourne la liste paginée des matériaux. Filtrage par recherche, fournisseur et statut actif.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des matériaux' })
  async findAll(
    @Query() query: QueryMateriauDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.materiauxService.findAll(query, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/materiaux/:id — Détail d'un matériau
  // ──────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: "Détail d'un matériau" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Matériau trouvé' })
  @ApiResponse({ status: 404, description: 'Matériau non trouvé' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.materiauxService.findOne(id, user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/materiaux/:id — Modifier un matériau
  // ──────────────────────────────────────────────
  @Roles(Role.ADMIN)//ajoutee pour que seul l'admin puisse modifier un matériau
  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un matériau (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Matériau modifié' })
  @ApiResponse({ status: 404, description: 'Matériau non trouvé' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMateriauDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.materiauxService.update(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/materiaux/:id — Supprimer un matériau
  // ──────────────────────────────────────────────

  @Roles(Role.ADMIN)//ajoutee pour que seul l'admin puisse supprimer un matériau
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer un matériau (Admin)',
    description: 'Désactive le matériau (soft delete).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Matériau désactivé' })
  @ApiResponse({ status: 404, description: 'Matériau non trouvé' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.materiauxService.delete(id, user);
  }
}
