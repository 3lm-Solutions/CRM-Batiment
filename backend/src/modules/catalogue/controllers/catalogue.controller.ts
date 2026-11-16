import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CatalogueService } from '../services/catalogue.service';
import {
  CreateCategorieDto,
  UpdateCategorieDto,
  CreateSousCategorieDto,
} from '../dto/catalogue.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * CONTRÔLEUR CATALOGUE
 *
 * Gère les catégories, sous-catégories et vues d'ensemble
 */
@ApiTags('Catalogue')
@ApiBearerAuth()
@Controller('catalogue')
@UseGuards(JwtAuthGuard)
export class CatalogueController {
  constructor(private catalogueService: CatalogueService) {}

  // ==================== CATÉGORIES ====================

  @Post('categories')
  @ApiOperation({ summary: 'Créer une catégorie de prestation' })
  async createCategorie(
    @CurrentUser() user: any,
    @Body() dto: CreateCategorieDto,
  ) {
    return this.catalogueService.createCategorie(user.companyId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lister toutes les catégories' })
  async findAllCategories(@CurrentUser() user: any) {
    return this.catalogueService.findAllCategories(user.companyId);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Obtenir une catégorie complète avec prestations' })
  async getCategorieComplete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.catalogueService.getCategorieComplete(parseInt(id), user.companyId);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Mettre à jour une catégorie' })
  async updateCategorie(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCategorieDto,
  ) {
    return this.catalogueService.updateCategorie(parseInt(id), user.companyId, dto);
  }

  // ==================== SOUS-CATÉGORIES ====================

  @Post('sous-categories')
  @ApiOperation({ summary: 'Créer une sous-catégorie' })
  async createSousCategorie(
    @CurrentUser() user: any,
    @Body() dto: CreateSousCategorieDto,
  ) {
    return this.catalogueService.createSousCategorie(user.companyId, dto);
  }

  // ==================== VUE D'ENSEMBLE ====================

  @Get()
  @ApiOperation({ summary: 'Obtenir le catalogue complet' })
  async getCatalogueComplet(@CurrentUser() user: any) {
    return this.catalogueService.getCatalogueComplet(user.companyId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher dans le catalogue' })
  async searchCatalogue(
    @CurrentUser() user: any,
    @Query('q') query: string,
  ) {
    return this.catalogueService.searchCatalogue(user.companyId, query);
  }
}
