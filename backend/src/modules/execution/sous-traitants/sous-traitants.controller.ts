import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { amountsFor, type AuthUser, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { DossierService } from './dossier.service';
import { CreateAssuranceDto, CreateDisponibiliteDto, CreateNotationDto, CreatePaiementDto, CreateSousTraitantDto, LierCompteDto, QuerySousTraitantsDto, UpdateAssuranceDto, UpdatePaiementDto, UpdateSousTraitantDto } from './dto/sous-traitants.dto';
import { SousTraitantsService } from './sous-traitants.service';

const READERS = [Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER];

/** Company records of sous-traitants. Write: ADMIN. Read: ADMIN, ASSISTANTE, CHEF_CHANTIER. */
@ApiTags('Sous-traitants')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('sous-traitants')
export class SousTraitantsController {
  constructor(
    private readonly sousTraitants: SousTraitantsService,
    private readonly dossier: DossierService,
  ) {}

  @Roles(...READERS)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QuerySousTraitantsDto) {
    return amountsFor(user, this.sousTraitants.findAll(user, query));
  }

  @Roles(...READERS)
  @Get(':id')
  @ApiOperation({ summary: 'Fiche complète : contrats, assurances, paiements, disponibilités, notes' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return amountsFor(user, this.sousTraitants.findOne(user, id));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSousTraitantDto) {
    return this.sousTraitants.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSousTraitantDto) {
    return this.sousTraitants.update(user, id, dto);
  }

  @Put(':id/compte')
  @ApiOperation({ summary: 'Lier le compte de connexion (portail) du sous-traitant' })
  lierCompte(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: LierCompteDto) {
    return this.sousTraitants.lierCompte(user, id, dto);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sousTraitants.remove(user, id);
  }

  // ── assurances ──
  @Post(':id/assurances')
  addAssurance(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateAssuranceDto) {
    return this.dossier.addAssurance(user, id, dto);
  }

  @Patch(':id/assurances/:aid')
  @ApiOperation({ summary: 'Modifier / renouveler (le statut est recalculé depuis la date)' })
  updateAssurance(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('aid', ParseIntPipe) aid: number,
    @Body() dto: UpdateAssuranceDto,
  ) {
    return this.dossier.updateAssurance(user, id, aid, dto);
  }

  @Delete(':id/assurances/:aid') @HttpCode(HttpStatus.NO_CONTENT)
  removeAssurance(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('aid', ParseIntPipe) aid: number) {
    return this.dossier.removeAssurance(user, id, aid);
  }

  // ── paiements ──
  @Post(':id/paiements')
  addPaiement(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreatePaiementDto) {
    return this.dossier.addPaiement(user, id, dto);
  }

  @Patch(':id/paiements/:pid')
  updatePaiement(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('pid', ParseIntPipe) pid: number,
    @Body() dto: UpdatePaiementDto,
  ) {
    return this.dossier.updatePaiement(user, id, pid, dto);
  }

  @Delete(':id/paiements/:pid') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un paiement saisi par erreur (un paiement effectué : statut ANNULE)' })
  removePaiement(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('pid', ParseIntPipe) pid: number) {
    return this.dossier.removePaiement(user, id, pid);
  }

  // ── disponibilités ──
  @Post(':id/disponibilites')
  addDisponibilite(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateDisponibiliteDto) {
    return this.dossier.addDisponibilite(user, id, dto);
  }

  @Delete(':id/disponibilites/:did') @HttpCode(HttpStatus.NO_CONTENT)
  removeDisponibilite(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('did', ParseIntPipe) did: number) {
    return this.dossier.removeDisponibilite(user, id, did);
  }

  // ── notations ──
  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @Post(':id/notations')
  @ApiOperation({ summary: 'Noter un sous-traitant (une note par chantier)' })
  addNotation(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateNotationDto) {
    return this.dossier.addNotation(user, id, dto);
  }

  @Delete(':id/notations/:nid') @HttpCode(HttpStatus.NO_CONTENT)
  removeNotation(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('nid', ParseIntPipe) nid: number) {
    return this.dossier.removeNotation(user, id, nid);
  }
}
