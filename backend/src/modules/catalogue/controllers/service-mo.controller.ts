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
import { ServiceMoService } from '../services/service-mo.service';
import {
  CreateServiceMoDto,
  UpdateServiceMoDto,
  ServiceMoQueryDto,
} from '../dto/service-mo.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * CONTRÔLEUR SERVICES MAIN D'OEUVRE
 *
 * Gère les services avec calcul de productivité et coût journalier
 */
@ApiTags('Catalogue - Services Main d\'Oeuvre')
@ApiBearerAuth()
@Controller('catalogue/services-mo')
@UseGuards(JwtAuthGuard)
export class ServiceMoController {
  constructor(private serviceMoService: ServiceMoService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un service main d\'oeuvre' })
  async create(@CurrentUser() user: any, @Body() dto: CreateServiceMoDto) {
    return this.serviceMoService.create(user.companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les services MO' })
  async findAll(@CurrentUser() user: any, @Query() query: ServiceMoQueryDto) {
    return this.serviceMoService.findAll(user.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un service MO' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.serviceMoService.findOne(parseInt(id), user.companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour un service MO' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateServiceMoDto,
  ) {
    return this.serviceMoService.update(parseInt(id), user.companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver un service MO' })
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.serviceMoService.deactivate(parseInt(id), user.companyId);
  }

  @Get(':id/prix')
  @ApiOperation({ summary: 'Calculer le coût main d\'oeuvre' })
  async calculateMoPrice(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('quantite') quantite: string,
  ) {
    return this.serviceMoService.calculateMoPrice(
      parseInt(id),
      parseFloat(quantite),
      user.companyId,
    );
  }

  @Get(':id/prestations')
  @ApiOperation({ summary: 'Lister les prestations utilisant ce service' })
  async getServicesByPrestation(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.serviceMoService.getServicesByPrestation(
      parseInt(id),
      user.companyId,
    );
  }
}
