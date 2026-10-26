import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, costsFor, CurrentUser, Roles, STAFF } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import { ReplaceCompositionsDto } from '../compositions/compositions.dto';
import { ChiffrageDto } from '../pricing/pricing.dto';
import { PricingService } from '../pricing/pricing.service';
import { CreatePrestationDto, QueryPrestationsDto, UpdatePrestationDto } from './prestations.dto';
import { PrestationsService } from './prestations.service';

@ApiTags('Catalogue — prestations')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('catalogue/prestations')
export class PrestationsController {
  constructor(
    private readonly prestations: PrestationsService,
    private readonly pricing: PricingService,
  ) {}

  @Roles(...STAFF)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryPrestationsDto) {
    return costsFor(user, this.prestations.findAll(user, query));
  }

  @Roles(...STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Détail : composition, options, choix et leurs compositions' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return costsFor(user, this.prestations.findOne(user, id));
  }

  @Roles(...BUREAU)
  @Post(':id/chiffrage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chiffrer une quantité avec des choix d’options',
    description:
      'Coût matériaux + main d’œuvre, prix suggéré, prix pour la marge cible, marge et alerte. ' +
      'Un choix ayant sa propre composition remplace la composition de base.',
  })
  chiffrer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ChiffrageDto) {
    return this.pricing.chiffrer(user, id, dto);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePrestationDto) {
    return this.prestations.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier (un changement de prix est historisé ; actif: false pour désactiver)' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePrestationDto) {
    return this.prestations.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression (409 si utilisée dans un devis — désactiver plutôt)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.prestations.remove(user, id);
  }

  @Put(':id/compositions')
  @ApiOperation({ summary: 'Remplacer la composition de base (liste complète, opération atomique)' })
  replaceCompositions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceCompositionsDto,
  ) {
    return this.prestations.replaceCompositions(user, id, dto);
  }
}
