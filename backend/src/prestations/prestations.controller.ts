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
import { PrestationsService } from './prestations.service.js';
import { CreateCategoriePrestationDto } from './dto/create-categorie-prestation.dto.js';
import { UpdateCategoriePrestationDto } from './dto/update-categorie-prestation.dto.js';
import { CreateSousCategorieDto } from './dto/create-sous-categorie.dto.js';
import { UpdateSousCategorieDto } from './dto/update-sous-categorie.dto.js';
import { CreatePrestationDto } from './dto/create-prestation.dto.js';
import { UpdatePrestationDto } from './dto/update-prestation.dto.js';
import { QueryPrestationDto } from './dto/query-prestation.dto.js';
import {
  CreateOptionPrestationDto,
  CreateChoixOptionDto,
} from './dto/create-option-prestation.dto.js';
import { UpdateOptionPrestationDto } from './dto/update-option-prestation.dto.js';
import { UpdateChoixOptionDto } from './dto/update-choix-option.dto.js';
import {
  CreatePrestationCompositionDto,
  UpdatePrestationCompositionDto,
} from './dto/manage-prestation-composition.dto.js';
import { UpdateChiffrageSettingsDto } from './dto/update-chiffrage-settings.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Prestations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE) // <-- AJOUTEE : restrict access to these roles for all endpoints in this controller
@Controller('prestations')
export class PrestationsController {
  constructor(private readonly prestationsService: PrestationsService) {}

  // ═══════════════════════════════════════════════
  // CATÉGORIES
  // ═══════════════════════════════════════════════

  // ──────────────────────────────────────────────
  // POST /api/prestations/categories — Créer une catégorie
  // ──────────────────────────────────────────────

  @Post('categories')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Créer une catégorie de prestation',
    description:
      "Crée une nouvelle catégorie rattachée à l'entreprise. Réservé aux admins.",
  })
  @ApiResponse({ status: 201, description: 'Catégorie créée' })
  @ApiResponse({ status: 409, description: 'Catégorie déjà existante' })
  async createCategorie(
    @Body() dto: CreateCategoriePrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.createCategorie(dto, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations/categories — Lister les catégories
  // ──────────────────────────────────────────────

  @Get('categories')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({
    summary: 'Liste des catégories de prestation',
    description:
      "Retourne toutes les catégories actives de l'entreprise avec le nombre de prestations.",
  })
  @ApiResponse({ status: 200, description: 'Liste des catégories' })
  async findAllCategories(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.findAllCategories(user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/prestations/categories/:id — Modifier une catégorie
  // ──────────────────────────────────────────────

  @Patch('categories/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier une catégorie de prestation' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Catégorie modifiée' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiResponse({ status: 409, description: 'Nom de catégorie déjà utilisé' })
  async updateCategorie(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriePrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updateCategorie(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/prestations/categories/:id — Supprimer une catégorie
  // ──────────────────────────────────────────────

  @Delete('categories/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer une catégorie (Admin)',
    description:
      'Désactive la catégorie. Impossible si des prestations actives y sont rattachées.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Catégorie désactivée' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiResponse({ status: 409, description: 'Prestations actives rattachées' })
  async deleteCategorie(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.deleteCategorie(id, user);
  }

  // ═══════════════════════════════════════════════
  // SOUS-CATÉGORIES
  // ═══════════════════════════════════════════════

  @Post('sous-categories')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer une sous-catégorie' })
  @ApiResponse({ status: 201, description: 'Sous-catégorie créée' })
  async createSousCategorie(
    @Body() dto: CreateSousCategorieDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.createSousCategorie(dto, user);
  }

  @Get('categories/:categorieId/sous-categories')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: "Lister les sous-catégories d'une catégorie" })
  @ApiParam({ name: 'categorieId', type: Number })
  async findAllSousCategories(
    @Param('categorieId', ParseIntPipe) categorieId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.findAllSousCategories(categorieId, user);
  }

  @Patch('sous-categories/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier une sous-catégorie' })
  @ApiParam({ name: 'id', type: Number })
  async updateSousCategorie(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSousCategorieDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updateSousCategorie(id, dto, user);
  }

  @Delete('sous-categories/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer une sous-catégorie' })
  @ApiParam({ name: 'id', type: Number })
  async deleteSousCategorie(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.deleteSousCategorie(id, user);
  }

  // ═══════════════════════════════════════════════
  // PRESTATIONS
  // ═══════════════════════════════════════════════

  // ──────────────────────────────────────────────
  // POST /api/prestations — Créer une prestation
  // ──────────────────────────────────────────────

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Créer une prestation',
    description: 'Crée une nouvelle prestation liée à une catégorie existante.',
  })
  @ApiResponse({ status: 201, description: 'Prestation créée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  async createPrestation(
    @Body() dto: CreatePrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.createPrestation(dto, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations/catalogue — Prestations avec compositions (checklist technicien)
  // ──────────────────────────────────────────────

  @Get('catalogue')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({
    summary: 'Catalogue complet avec compositions',
    description:
      'Retourne toutes les prestations groupées par catégorie avec leurs matériaux et services MO liés.',
  })
  @ApiResponse({ status: 200, description: 'Catalogue avec compositions' })
  async findAllWithCompositions(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.findAllWithCompositions(user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations/catalogue-complet — Catalogue enrichi (questions + infos requises)
  // ──────────────────────────────────────────────

  @Get('catalogue-complet')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({
    summary: 'Catalogue complet enrichi pour technicien/chatbot',
    description:
      'Retourne le catalogue avec questions diagnostiques, options, infos requises et compositions.',
  })
  @ApiResponse({ status: 200, description: 'Catalogue enrichi complet' })
  async findCatalogueComplet(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.findCatalogueComplet(user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations/choix/:choixId/compositions — Compositions d'un choix d'option
  // ──────────────────────────────────────────────

  @Get('choix/:choixId/compositions')
  @ApiOperation({
    summary: "Compositions spécifiques d'un choix d'option",
    description:
      'Retourne les matériaux et services main d\'œuvre liés à un choix d\'option spécifique (ex: "Chape allégée")',
  })
  @ApiResponse({ status: 200, description: 'Compositions du choix' })
  async getChoixCompositions(
    @Param('choixId', new ParseIntPipe()) choixId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.getChoixCompositions(choixId, user);
  }

  // ──────────────────────────────────────────────
  // CRUD compositions de prestation (Admin)
  // ──────────────────────────────────────────────

  @Post('compositions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Ajouter une composition à une prestation' })
  @ApiResponse({ status: 201, description: 'Composition créée' })
  async createPrestationComposition(
    @Body() dto: CreatePrestationCompositionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.createPrestationComposition(dto, user);
  }

  @Patch('compositions/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier une composition de prestation' })
  @ApiParam({ name: 'id', type: Number })
  async updatePrestationComposition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrestationCompositionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updatePrestationComposition(id, dto, user);
  }

  @Delete('compositions/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer une composition de prestation' })
  @ApiParam({ name: 'id', type: Number })
  async deletePrestationComposition(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.deletePrestationComposition(id, user);
  }

  // ──────────────────────────────────────────────
  // Paramètres de chiffrage / publication catalogue (Admin)
  // ──────────────────────────────────────────────

  @Get('admin/chiffrage-settings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lire les paramètres de chiffrage admin' })
  async getChiffrageSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.getChiffrageSettings(user);
  }

  @Patch('admin/chiffrage-settings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les paramètres de chiffrage admin' })
  async updateChiffrageSettings(
    @Body() dto: UpdateChiffrageSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updateChiffrageSettings(dto, user);
  }

  @Get('admin/catalogue-validation')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Valider le catalogue avant publication' })
  async validateCatalogue(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.validateCatalogue(user);
  }

  @Get('admin/catalogue-publication-status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Dernier statut de publication du catalogue' })
  async getCataloguePublicationStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.getCataloguePublicationStatus(user);
  }

  @Get('admin/catalogue-publication-history')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Historique des publications du catalogue' })
  async getCataloguePublicationHistory(
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.getCataloguePublicationHistory(user);
  }

  @Post('admin/catalogue-publication')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Publier le catalogue après validation obligatoire',
  })
  async publishCatalogue(@CurrentUser() user: CurrentUserPayload) {
    return this.prestationsService.publishCatalogue(user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations — Liste paginée + filtres
  // ──────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Liste des prestations',
    description:
      'Retourne la liste paginée des prestations. Filtrage par recherche, catégorie et statut actif.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des prestations' })
  async findAllPrestations(
    @Query() query: QueryPrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.findAllPrestations(query, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations/:id/chiffrage — Calcul automatique du coût
  // ──────────────────────────────────────────────

  @Get(':id/chiffrage')
  @ApiOperation({
    summary: 'Chiffrage automatique',
    description:
      'Calcule le coût matériaux + MO + prix vente suggéré pour une prestation et une quantité.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Chiffrage calculé' })
  @ApiResponse({ status: 404, description: 'Prestation non trouvée' })
  async chiffrage(
    @Param('id', ParseIntPipe) id: number,
    @Query('quantite') quantiteStr: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const quantite = parseFloat(quantiteStr) || 1;
    return this.prestationsService.chiffrage(id, quantite, user);
  }

  // ──────────────────────────────────────────────
  // GET /api/prestations/:id — Détail d'une prestation
  // ──────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une prestation" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Prestation trouvée' })
  @ApiResponse({ status: 404, description: 'Prestation non trouvée' })
  async findOnePrestation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.findOnePrestation(id, user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/prestations/:id — Modifier une prestation
  // ──────────────────────────────────────────────

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier une prestation' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Prestation modifiée' })
  @ApiResponse({ status: 404, description: 'Prestation non trouvée' })
  async updatePrestation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updatePrestation(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/prestations/:id — Supprimer une prestation
  // ──────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer une prestation (Admin)',
    description:
      'Supprime définitivement la prestation et nettoie ses relations.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Prestation supprimée définitivement',
  })
  @ApiResponse({ status: 404, description: 'Prestation non trouvée' })
  async deletePrestation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.deletePrestation(id, user);
  }

  // ═══════════════════════════════════════════════
  // OPTIONS DE PRESTATION
  // ═══════════════════════════════════════════════

  @Post('options')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer une option de prestation avec ses choix' })
  @ApiResponse({ status: 201, description: 'Option créée' })
  async createOptionPrestation(
    @Body() dto: CreateOptionPrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.createOptionPrestation(dto, user);
  }

  @Get(':id/options')
  @ApiOperation({ summary: "Lister les options d'une prestation" })
  @ApiParam({ name: 'id', type: Number })
  async findOptionsByPrestation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.findOptionsByPrestation(id, user);
  }

  @Patch('options/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier une option' })
  @ApiParam({ name: 'id', type: Number })
  async updateOptionPrestation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOptionPrestationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updateOptionPrestation(id, dto, user);
  }

  @Delete('options/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer une option et ses choix' })
  @ApiParam({ name: 'id', type: Number })
  async deleteOptionPrestation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.deleteOptionPrestation(id, user);
  }

  // ═══════════════════════════════════════════════
  // CHOIX D'OPTIONS
  // ═══════════════════════════════════════════════

  @Post('options/:optionId/choix')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Ajouter un choix à une option' })
  @ApiParam({ name: 'optionId', type: Number })
  async addChoixToOption(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: CreateChoixOptionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.addChoixToOption(optionId, dto, user);
  }

  @Delete('choix/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un choix' })
  @ApiParam({ name: 'id', type: Number })
  async deleteChoixOption(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.deleteChoixOption(id, user);
  }

  @Patch('choix/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier un choix' })
  @ApiParam({ name: 'id', type: Number })
  async updateChoixOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChoixOptionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.prestationsService.updateChoixOption(id, dto, user);
  }
}
