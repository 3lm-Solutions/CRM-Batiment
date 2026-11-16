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
import { MaterialService } from '../services/material.service';
import {
  CreateMateriauxDto,
  UpdateMateriauxDto,
  MateriauxQueryDto,
} from '../dto/materiau.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * CONTRÔLEUR MATÉRIAUX
 *
 * Gère la bibliothèque de matériaux avec détails (couleur, finition, fournisseur)
 */
@ApiTags('Catalogue - Matériaux')
@ApiBearerAuth()
@Controller('catalogue/materiaux')
@UseGuards(JwtAuthGuard)
export class MaterialController {
  constructor(private materielService: MaterialService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un matériau' })
  async create(@CurrentUser() user: any, @Body() dto: CreateMateriauxDto) {
    return this.materielService.create(user.companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les matériaux avec filtres' })
  async findAll(@CurrentUser() user: any, @Query() query: MateriauxQueryDto) {
    return this.materielService.findAll(user.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un matériau' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.materielService.findOne(parseInt(id), user.companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour un matériau' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMateriauxDto,
  ) {
    return this.materielService.update(parseInt(id), user.companyId, dto);
  }

  @Put(':id/prix')
  @ApiOperation({ summary: 'Mettre à jour le prix d\'achat' })
  async updatePrice(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('prix') prix: number,
  ) {
    return this.materielService.updatePrice(parseInt(id), user.companyId, prix);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver un matériau' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.materielService.deactivate(parseInt(id), user.companyId);
  }

  @Get(':id/prix-estime')
  @ApiOperation({ summary: 'Calculer le prix d\'achat estimé' })
  async getPrixEstime(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('quantite') quantite: string,
  ) {
    return this.materielService.getPrixAchatEstime(
      parseInt(id),
      parseFloat(quantite),
      user.companyId,
    );
  }

  @Get(':id/prestations')
  @ApiOperation({ summary: 'Lister les prestations utilisant ce matériau' })
  async getMateriauxByPrestation(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.materielService.getMateriauxByPrestation(
      parseInt(id),
      user.companyId,
    );
  }
}
