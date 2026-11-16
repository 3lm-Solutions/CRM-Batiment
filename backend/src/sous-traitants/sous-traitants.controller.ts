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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SousTraitantsService } from './sous-traitants.service.js';
import {
  CreateSousTraitantDto, UpdateSousTraitantDto,
  CreateContratSousTraitantDto, UpdateContratSousTraitantDto,
  CreateAssuranceSousTraitantDto, UpdateAssuranceSousTraitantDto,
  CreatePaiementSousTraitantDto, UpdatePaiementSousTraitantDto,
  CreateDisponibiliteSousTraitantDto, UpdateDisponibiliteSousTraitantDto,
  CreateNotationSousTraitantDto, UpdateNotationSousTraitantDto
} from './dto/sous-traitants.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Sous-Traitants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Restricted to Admin by default for all CRUDs
@Controller('sous-traitants')
export class SousTraitantsController {
  constructor(private readonly service: SousTraitantsService) {}

  // ==========================================
  // 1. SOUS-TRAITANT
  // ==========================================

  @Post()
  @ApiOperation({ summary: 'Créer un sous-traitant (Admin)' })
  async createSousTraitant(@Body() dto: CreateSousTraitantDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createSousTraitant(dto, user.companyId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Lister les sous-traitants (Admin/Assistante)' })
  async findAllSousTraitants(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.service.findAllSousTraitants(user!.companyId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }


  // ==========================================
  // 2. CONTRAT
  // ==========================================

  @Post('contrats')
  @ApiOperation({ summary: 'Créer un contrat de sous-traitance (Admin)' })
  async createContrat(@Body() dto: CreateContratSousTraitantDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createContrat(dto, user.companyId);
  }

  @Get('contrats')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Lister les contrats (Admin/Assistante)' })
  async findAllContrats(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.service.findAllContrats(user!.companyId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('contrats/:id')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Détail d’un contrat (Admin/Assistante)' })
  @ApiParam({ name: 'id', type: Number })
  async findOneContrat(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOneContrat(id, user.companyId);
  }

  @Patch('contrats/:id')
  @ApiOperation({ summary: 'Modifier un contrat (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async updateContrat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContratSousTraitantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateContrat(id, dto, user.companyId);
  }

  @Delete('contrats/:id')
  @ApiOperation({ summary: 'Supprimer un contrat (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async deleteContrat(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.deleteContrat(id, user.companyId);
  }

  // ==========================================
  // 3. ASSURANCE
  // ==========================================

  @Post('assurances')
  @ApiOperation({ summary: 'Créer une attestation d’assurance (Admin)' })
  async createAssurance(@Body() dto: CreateAssuranceSousTraitantDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createAssurance(dto, user.companyId);
  }

  @Get('assurances')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Lister les assurances (Admin/Assistante)' })
  async findAllAssurances(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.service.findAllAssurances(user!.companyId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('assurances/:id')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Détail d’une assurance (Admin/Assistante)' })
  @ApiParam({ name: 'id', type: Number })
  async findOneAssurance(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOneAssurance(id, user.companyId);
  }

  @Patch('assurances/:id')
  @ApiOperation({ summary: 'Modifier une assurance (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async updateAssurance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssuranceSousTraitantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateAssurance(id, dto, user.companyId);
  }

  @Delete('assurances/:id')
  @ApiOperation({ summary: 'Supprimer une assurance (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async deleteAssurance(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.deleteAssurance(id, user.companyId);
  }

  // ==========================================
  // 4. PAIEMENT
  // ==========================================

  @Post('paiements')
  @ApiOperation({ summary: 'Enregistrer un paiement (Admin)' })
  async createPaiement(@Body() dto: CreatePaiementSousTraitantDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createPaiement(dto, user.companyId);
  }

  @Get('paiements')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Lister les paiements (Admin/Assistante)' })
  async findAllPaiements(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.service.findAllPaiements(user!.companyId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('paiements/:id')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Détail d’un paiement (Admin/Assistante)' })
  @ApiParam({ name: 'id', type: Number })
  async findOnePaiement(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOnePaiement(id, user.companyId);
  }

  @Patch('paiements/:id')
  @ApiOperation({ summary: 'Modifier un paiement (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async updatePaiement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaiementSousTraitantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updatePaiement(id, dto, user.companyId);
  }

  @Delete('paiements/:id')
  @ApiOperation({ summary: 'Supprimer un paiement (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async deletePaiement(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.deletePaiement(id, user.companyId);
  }

  // ==========================================
  // 5. DISPONIBILITE
  // ==========================================

  @Post('disponibilites')
  @ApiOperation({ summary: 'Enregistrer une indisponibilité (Admin)' })
  async createDisponibilite(@Body() dto: CreateDisponibiliteSousTraitantDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createDisponibilite(dto, user.companyId);
  }

  @Get('disponibilites')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Lister les disponibilités (Admin/Assistante)' })
  async findAllDisponibilites(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.service.findAllDisponibilites(user!.companyId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('disponibilites/:id')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Détail d’une disponibilité (Admin/Assistante)' })
  @ApiParam({ name: 'id', type: Number })
  async findOneDisponibilite(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOneDisponibilite(id, user.companyId);
  }

  @Patch('disponibilites/:id')
  @ApiOperation({ summary: 'Modifier une disponibilité (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async updateDisponibilite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDisponibiliteSousTraitantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateDisponibilite(id, dto, user.companyId);
  }

  @Delete('disponibilites/:id')
  @ApiOperation({ summary: 'Supprimer une disponibilité (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async deleteDisponibilite(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.deleteDisponibilite(id, user.companyId);
  }

  // ==========================================
  // 6. NOTATION
  // ==========================================

  @Post('notations')
  @ApiOperation({ summary: 'Ajouter une notation (Admin)' })
  async createNotation(@Body() dto: CreateNotationSousTraitantDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.createNotation(dto, user.companyId);
  }

  @Get('notations')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Lister les notations (Admin/Assistante)' })
  async findAllNotations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.service.findAllNotations(user!.companyId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('notations/:id')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Détail d’une notation (Admin/Assistante)' })
  @ApiParam({ name: 'id', type: Number })
  async findOneNotation(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOneNotation(id, user.companyId);
  }

  @Patch('notations/:id')
  @ApiOperation({ summary: 'Modifier une notation (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async updateNotation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotationSousTraitantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateNotation(id, dto, user.companyId);
  }

  @Delete('notations/:id')
  @ApiOperation({ summary: 'Supprimer une notation (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async deleteNotation(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.deleteNotation(id, user.companyId);
  }

  // Wildcard routes for main resource moved to the bottom to avoid route conflict with static sub-resource endpoints
  @Get(':id')
  @Roles(Role.ADMIN, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Détail d’un sous-traitant (Admin/Assistante)' })
  @ApiParam({ name: 'id', type: Number })
  async findOneSousTraitant(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOneSousTraitant(id, user.companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un sous-traitant (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async updateSousTraitant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSousTraitantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateSousTraitant(id, dto, user.companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un sous-traitant (Admin)' })
  @ApiParam({ name: 'id', type: Number })
  async deleteSousTraitant(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.deleteSousTraitant(id, user.companyId);
  }
}
