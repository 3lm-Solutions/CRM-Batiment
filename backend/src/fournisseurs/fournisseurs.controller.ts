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
import { FournisseursService } from './fournisseurs.service.js';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto.js';
import { UpdateFournisseurDto } from './dto/update-fournisseur.dto.js';
import { QueryFournisseurDto } from './dto/query-fournisseur.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Fournisseurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fournisseurs')
export class FournisseursController {
  constructor(private readonly fournisseursService: FournisseursService) {}

  // ──────────────────────────────────────────────
  // POST /api/fournisseurs — Créer un fournisseur
  // ──────────────────────────────────────────────

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Créer un fournisseur (Admin)',
    description: "Ajoute un fournisseur au carnet d'adresses de l'entreprise.",
  })
  @ApiResponse({ status: 201, description: 'Fournisseur créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(
    @Body() dto: CreateFournisseurDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fournisseursService.create(dto, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/fournisseurs — Liste paginée + filtres
  // ──────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Liste des fournisseurs',
    description:
      'Retourne la liste paginée des fournisseurs avec le nombre de matériaux et commandes.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des fournisseurs' })
  async findAll(
    @Query() query: QueryFournisseurDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fournisseursService.findAll(query, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/fournisseurs/:id — Détail d'un fournisseur
  // ──────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: "Détail d'un fournisseur",
    description:
      'Retourne les infos du fournisseur avec la liste de ses matériaux actifs.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Fournisseur trouvé' })
  @ApiResponse({ status: 404, description: 'Fournisseur non trouvé' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fournisseursService.findOne(id, user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/fournisseurs/:id — Modifier un fournisseur
  // ──────────────────────────────────────────────

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier un fournisseur (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Fournisseur modifié' })
  @ApiResponse({ status: 404, description: 'Fournisseur non trouvé' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFournisseurDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fournisseursService.update(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/fournisseurs/:id — Supprimer un fournisseur
  // ──────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer un fournisseur (Admin)',
    description: 'Désactive le fournisseur (soft delete).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Fournisseur désactivé' })
  @ApiResponse({ status: 404, description: 'Fournisseur non trouvé' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fournisseursService.delete(id, user);
  }
}
