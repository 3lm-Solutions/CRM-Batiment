import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { DemandesDevisService } from './demandes-devis.service';
import { CreateDemandeDevisDto, QueryDemandesDevisDto, UpdateDemandeDevisDto } from './dto/demandes-devis.dto';

@ApiTags('Demandes de devis')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('demandes-devis')
export class DemandesDevisController {
  constructor(private readonly demandes: DemandesDevisService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDemandesDevisDto) {
    return this.demandes.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDemandeDevisDto) {
    return this.demandes.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDemandeDevisDto) {
    return this.demandes.update(user, id, dto);
  }

  @Post(':id/prendre-en-charge')
  @HttpCode(HttpStatus.OK)
  prendreEnCharge(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.changerStatut(user, id, 'EN_COURS');
  }

  @Post(':id/qualifier')
  @HttpCode(HttpStatus.OK)
  qualifier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.changerStatut(user, id, 'QUALIFIE');
  }

  @Post(':id/perdre')
  @HttpCode(HttpStatus.OK)
  perdre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.changerStatut(user, id, 'PERDU');
  }

  @Post(':id/reouvrir')
  @HttpCode(HttpStatus.OK)
  reouvrir(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.changerStatut(user, id, 'EN_COURS');
  }

  @Roles(Role.ADMIN, Role.TECHNICO)
  @Post(':id/convertir-en-devis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P0.1 — créer le devis brouillon (idempotent : renvoie le même devis si déjà converti)' })
  convertir(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.convertirEnDevis(user, id);
  }

  @Roles(Role.ADMIN, Role.TECHNICO)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demandes.remove(user, id);
  }
}
