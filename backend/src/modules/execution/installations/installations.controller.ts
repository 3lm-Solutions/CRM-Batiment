import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, FACTURATION, Roles } from '../../../common';
import {
  AttribuerDto,
  CreerInstallationDto,
  ModifierInstallationDto,
  MotifDto,
  QueryInstallationsDto,
} from './installations.dto';
import { InstallationsService } from './installations.service';

/** The office (ADMIN, ASSISTANTE) follows the delegated installations — lot B, 18/11. */
const GESTION = FACTURATION;

export const pdf = (buffer: Buffer, nom: string) =>
  new StreamableFile(buffer, {
    type: 'application/pdf',
    length: buffer.length,
    disposition: `inline; filename="${encodeURIComponent(nom)}.pdf"`,
  });

@ApiTags('Installations déléguées')
@ApiBearerAuth()
@Roles(...GESTION)
@Controller('installations')
export class InstallationsController {
  constructor(private readonly installations: InstallationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Installations déléguées (filtres : étape, en retard, alerte livraison) — retards en premier',
  })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryInstallationsDto) {
    return this.installations.liste(user, query);
  }

  @Get('compteurs')
  @ApiOperation({
    summary: 'Nombre par étape, en retard, alertes livraison, PV à vérifier, signalements',
  })
  compteurs(@CurrentUser() user: AuthUser) {
    return this.installations.compteurs(user);
  }

  @Get('installateurs')
  @ApiOperation({ summary: 'Installateurs à proposer : note moyenne, missions en cours' })
  installateurs(@CurrentUser() user: AuthUser) {
    return this.installations.installateurs(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Une installation : chronologie, livraisons, photos, signalements, PV' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.installations.detail(user, id);
  }

  @Post()
  @ApiOperation({ summary: '« Déléguer la pose » d’un chantier (mode Les deux)' })
  creer(@CurrentUser() user: AuthUser, @Body() dto: CreerInstallationDto) {
    return this.installations.creer(user, dto.chantierId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Changer la date souhaitée ou la note (l’installateur est prévenu)' })
  async modifier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModifierInstallationDto,
  ) {
    await this.installations.modifier(user, id, dto);
    return this.installations.detail(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Annuler la délégation (seulement avant l’acceptation de la mission)' })
  supprimer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.installations.supprimer(user, id);
  }

  @Post(':id/attribuer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proposer la mission à un installateur (avec une note et une date souhaitée)',
  })
  async attribuer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AttribuerDto,
  ) {
    await this.installations.attribuer(user, id, dto);
    return this.installations.detail(user, id);
  }

  @Post(':id/relancer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Relancer l’installateur (une fois par heure au plus)' })
  async relancer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.installations.relancer(user, id);
    return this.installations.detail(user, id);
  }

  @Post(':id/dates/accepter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter la date proposée par l’installateur' })
  async accepterDate(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.installations.accepterDate(user, id);
    return this.installations.detail(user, id);
  }

  @Post(':id/pv/valider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PV envoyé sans QR lisible : le valider (installation terminée)' })
  async validerPv(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.installations.validerPv(user, id);
    return this.installations.detail(user, id);
  }

  @Post(':id/pv/rejeter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PV envoyé sans QR lisible : le refuser (motif, l’installateur renvoie)',
  })
  async rejeterPv(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotifDto,
  ) {
    await this.installations.rejeterPv(user, id, dto.motif);
    return this.installations.detail(user, id);
  }

  @Get(':id/pv')
  @ApiOperation({ summary: 'PV de fin de travaux à imprimer (PDF avec QR code)' })
  async pdfPv(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const i = await this.installations.charger(user.companyId, id);
    return pdf(await this.installations.pdfPv(user, id), `PV-${i.reference}`);
  }

  @Post(':id/signalements/:signalementId/traiter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer un signalement comme traité' })
  traiter(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('signalementId', ParseIntPipe) signalementId: number,
  ) {
    return this.installations.traiterSignalement(user, id, signalementId);
  }

  @Post(':id/signalements/:signalementId/sav')
  @ApiOperation({ summary: 'Transformer un signalement en ticket SAV du chantier' })
  creerSav(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('signalementId', ParseIntPipe) signalementId: number,
  ) {
    return this.installations.creerSav(user, id, signalementId);
  }

  @Post(':id/cloturer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clôturer une installation terminée' })
  async cloturer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.installations.cloturer(user, id);
    return this.installations.detail(user, id);
  }
}
