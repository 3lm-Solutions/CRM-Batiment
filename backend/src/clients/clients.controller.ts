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
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { QueryClientDto } from './dto/query-client.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE) // <-- AJOUTEE : restrict access to these roles for all endpoints in this controller
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ──────────────────────────────────────────────
  // POST /api/clients — Créer un client
  // ──────────────────────────────────────────────

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Créer un client',
    description:
      "Crée un nouveau client rattaché à l'entreprise de l'utilisateur connecté.",
  })
  @ApiResponse({ status: 201, description: 'Client créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.create(dto, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/clients — Liste paginée + recherche
  // ──────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({
    summary: 'Liste des clients',
    description:
      'Retourne la liste paginée des clients. Filtrage par recherche et source.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des clients' })
  async findAll(
    @Query() query: QueryClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.findAll(query, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/clients/:id — Détail d'un client
  // ──────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: "Détail d'un client" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Client trouvé' })
  @ApiResponse({ status: 404, description: 'Client non trouvé' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.findOne(id, user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/clients/:id — Modifier un client
  // ──────────────────────────────────────────────

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Modifier un client' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Client modifié' })
  @ApiResponse({ status: 404, description: 'Client non trouvé' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/clients/:id — Supprimer un client
  // ──────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer un client (Admin)',
    description: 'Supprime définitivement un client. Réservé aux admins.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Client supprimé' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux admins' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.remove(id, user);
  }
}
