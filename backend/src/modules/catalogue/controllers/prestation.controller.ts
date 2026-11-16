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
import { PrestationService } from '../services/prestation.service';
import {
  CreatePrestationDto,
  UpdatePrestationDto,
  PrestationQueryDto,
  AddCompositionDto,
  AddOptionDto,
  AddChoixOptionDto,
} from '../dto/prestation.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * CONTRÔLEUR PRESTATIONS
 *
 * Gère les prestations complètes avec:
 * - Compositions (matériaux + MO)
 * - Options et choix
 * - Infos requises (mesures, photos, observations)
 */
@ApiTags('Catalogue - Prestations')
@ApiBearerAuth()
@Controller('catalogue/prestations')
@UseGuards(JwtAuthGuard)
export class PrestationController {
  constructor(private prestationService: PrestationService) {}

  // ==================== PRESTATIONS ====================

  @Post()
  @ApiOperation({ summary: 'Créer une prestation' })
  async create(@CurrentUser() user: any, @Body() dto: CreatePrestationDto) {
    return this.prestationService.create(user.companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les prestations' })
  async findAll(@CurrentUser() user: any, @Query() query: PrestationQueryDto) {
    return this.prestationService.findAll(user.companyId, query);
  }

  @Get(':id/complete')
  @ApiOperation({ summary: 'Obtenir une prestation avec tous les détails' })
  async findOneComplete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prestationService.findOneComplete(parseInt(id), user.companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour une prestation' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePrestationDto,
  ) {
    return this.prestationService.update(parseInt(id), user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver une prestation' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prestationService.deactivate(parseInt(id), user.companyId);
  }

  // ==================== COMPOSITIONS ====================

  @Post(':id/compositions')
  @ApiOperation({ summary: 'Ajouter un matériau/service à une prestation' })
  async addComposition(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddCompositionDto,
  ) {
    return this.prestationService.addComposition(
      parseInt(id),
      user.companyId,
      dto,
    );
  }

  // ==================== OPTIONS ====================

  @Post(':id/options')
  @ApiOperation({ summary: 'Ajouter une option à une prestation' })
  async addOption(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddOptionDto,
  ) {
    return this.prestationService.addOption(parseInt(id), user.companyId, dto);
  }

  @Post('options/:optionId/choix')
  @ApiOperation({ summary: 'Ajouter un choix à une option' })
  async addChoixOption(
    @Param('optionId') optionId: string,
    @CurrentUser() user: any,
    @Body() dto: AddChoixOptionDto,
  ) {
    return this.prestationService.addChoixOption(
      parseInt(optionId),
      user.companyId,
      dto,
    );
  }

}
