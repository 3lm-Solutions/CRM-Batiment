import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { amountsFor, type AuthUser, BUREAU, CurrentUser, Roles, STAFF } from '../../../common';
import { CreateCommandeDto, QueryCommandesDto, ReceptionDto, UpdateCommandeDto, UpdateLignesCommandeDto } from './commandes.dto';
import { CommandesService } from './commandes.service';

@ApiTags('Commandes fournisseur')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('commandes-fournisseur')
export class CommandesController {
  constructor(private readonly commandes: CommandesService) {}

  @Roles(...STAFF)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryCommandesDto) {
    return amountsFor(user, this.commandes.findAll(user, query));
  }

  @Post()
  @ApiOperation({ summary: 'Commande manuelle : un fournisseur et ses matériaux (prix du catalogue)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCommandeDto) {
    return this.commandes.create(user, dto);
  }

  @Roles(...STAFF)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return amountsFor(user, this.commandes.findOne(user, id));
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommandeDto) {
    return this.commandes.update(user, id, dto);
  }

  @Put(':id/lignes')
  @ApiOperation({ summary: 'Ajuster les quantités avant envoi (ex. arrondir au sac complet)' })
  updateLignes(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLignesCommandeDto) {
    return this.commandes.updateLignes(user, id, dto);
  }

  @Post(':id/envoyer') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoyer le bon de commande au fournisseur par email' })
  envoyer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.commandes.envoyer(user, id);
  }

  @Post(':id/expediee') @HttpCode(HttpStatus.OK)
  expediee(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.commandes.changerStatut(user, id, 'EXPEDIEE');
  }

  @Roles(...STAFF)
  @Post(':id/receptions')
  @ApiOperation({ summary: 'Réceptionner une livraison (partielle ou totale) — met le stock à jour' })
  receptionner(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReceptionDto) {
    return amountsFor(user, this.commandes.receptionner(user, id, dto));
  }

  @Post(':id/cloturer') @HttpCode(HttpStatus.OK)
  cloturer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.commandes.changerStatut(user, id, 'CLOTUREE');
  }

  @Post(':id/annuler') @HttpCode(HttpStatus.OK)
  annuler(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.commandes.changerStatut(user, id, 'ANNULEE');
  }
}
