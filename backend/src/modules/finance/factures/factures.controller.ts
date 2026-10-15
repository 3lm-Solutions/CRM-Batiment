import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles, STAFF } from '../../../common';
import { AnnulerFactureDto, CreateSituationDto, EmettreFactureDto, FactureLigneDto, PayerFactureDto, QueryFacturesDto, UpdateFactureDto } from './dto/factures.dto';
import { FacturesService } from './factures.service';

@ApiTags('Factures')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller()
export class FacturesController {
  constructor(private readonly factures: FacturesService) {}

  @Roles(...STAFF)
  @Get('factures')
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryFacturesDto) {
    return this.factures.findAll(user, query);
  }

  @Roles(...STAFF)
  @Get('factures/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.factures.findOne(user, id);
  }

  @Post('devis/:devisId/factures/situation')
  @ApiOperation({ summary: 'Situation de travaux (avancement cumulé en %)' })
  situation(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: CreateSituationDto) {
    return this.factures.creerSituation(user, devisId, dto);
  }

  @Post('devis/:devisId/factures/finale')
  @ApiOperation({ summary: 'Facture finale (déduit acomptes et situations émis)' })
  finale(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number) {
    return this.factures.creerFinale(user, devisId);
  }

  @Patch('factures/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFactureDto) {
    return this.factures.update(user, id, dto);
  }

  @Post('factures/:id/lignes')
  addLigne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: FactureLigneDto) {
    return this.factures.addLigne(user, id, dto);
  }

  @Patch('factures/:id/lignes/:ligneId')
  updateLigne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() dto: FactureLigneDto,
  ) {
    return this.factures.updateLigne(user, id, ligneId, dto);
  }

  @Delete('factures/:id/lignes/:ligneId')
  removeLigne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('ligneId', ParseIntPipe) ligneId: number) {
    return this.factures.removeLigne(user, id, ligneId);
  }

  @Post('factures/:id/emettre') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Émettre : numéro attribué, coordonnées figées, plus modifiable' })
  emettre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: EmettreFactureDto) {
    return this.factures.emettre(user, id, dto);
  }

  @Post('factures/:id/envoyer') @HttpCode(HttpStatus.OK)
  async envoyer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return { emailSent: await this.factures.envoyerEmail(user, id) };
  }

  @Post('factures/:id/payer') @HttpCode(HttpStatus.OK)
  payer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PayerFactureDto) {
    return this.factures.marquerPayee(user, id, dto);
  }

  @Post('factures/:id/annuler') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Brouillon : annulé. Émise : un avoir est émis automatiquement.' })
  annuler(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AnnulerFactureDto) {
    return this.factures.annuler(user, id, dto);
  }

  @Delete('factures/:id') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un brouillon (une facture émise ne se supprime jamais)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.factures.removeDraft(user, id);
  }
}
