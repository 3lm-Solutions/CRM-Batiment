import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { MAX_PHOTOS_PER_RAPPORT, type UploadedBinary } from '../../core/storage/upload.config';
import { CreateDisponibiliteDto } from '../../execution/sous-traitants/dto/sous-traitants.dto';
import { CreateRapportDto } from '../rapports/rapports.dto';
import { RapportsService } from '../rapports/rapports.service';
import { AvancementTacheDto, QueryRapportsDto } from './portail-sous-traitant.dto';
import { CocherChecklistItemDto } from '../../execution/chantiers/checklist/checklist.dto';
import { ChecklistService } from '../../execution/chantiers/checklist/checklist.service';
import { PortailSousTraitantService } from './portail-sous-traitant.service';

/** Portal of a SOUS_TRAITANT account. Every route is scoped to the job sites opened to him. */
@ApiTags('Portail sous-traitant')
@Roles(Role.SOUS_TRAITANT)
@Controller('portail/sous-traitant')
export class PortailSousTraitantController {
  constructor(
    private readonly portail: PortailSousTraitantService,
    private readonly rapports: RapportsService,
    private readonly checklist: ChecklistService,
  ) {}

  @Get('profil')
  profil(@CurrentUser() user: AuthUser) {
    return this.portail.profil(user);
  }

  @Get('tableau-de-bord')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.portail.dashboard(user);
  }

  @Get('chantiers')
  chantiers(@CurrentUser() user: AuthUser) {
    return this.portail.chantiers(user);
  }

  @Get('chantiers/:id')
  chantier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.portail.chantier(user, id);
  }

  @Patch('taches/:tacheId/checklist/:itemId')
  @ApiOperation({ summary: 'Cocher / décocher un point d’une de mes tâches (l’avancement suit)' })
  cocher(
    @CurrentUser() user: AuthUser,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CocherChecklistItemDto,
  ) {
    return this.checklist.cocherPortail(user, tacheId, itemId, dto.fait);
  }

  @Patch('taches/:id')
  @ApiOperation({ summary: 'Mettre à jour l’avancement d’une tâche qui m’est affectée' })
  avancerTache(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AvancementTacheDto) {
    return this.portail.avancerTache(user, id, dto);
  }

  @Get('disponibilites')
  @ApiOperation({ summary: 'Mes disponibilités (périodes en cours et à venir)' })
  disponibilites(@CurrentUser() user: AuthUser) {
    return this.portail.disponibilites(user);
  }

  @Post('disponibilites')
  @ApiOperation({ summary: 'Indiquer une période disponible ou indisponible' })
  ajouterDisponibilite(@CurrentUser() user: AuthUser, @Body() dto: CreateDisponibiliteDto) {
    return this.portail.ajouterDisponibilite(user, dto);
  }

  @Delete('disponibilites/:id') @HttpCode(HttpStatus.NO_CONTENT)
  supprimerDisponibilite(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.portail.supprimerDisponibilite(user, id);
  }

  @Get('rapports')
  mesRapports(@CurrentUser() user: AuthUser, @Query() query: QueryRapportsDto) {
    return this.rapports.mine(user, query);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('rapports')
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_PER_RAPPORT))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['chantierId', 'contenu'],
      properties: {
        chantierId: { type: 'integer' },
        tacheId: { type: 'integer' },
        contenu: { type: 'string' },
        avancement: { type: 'integer', minimum: 0, maximum: 100 },
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Envoyer un rapport (texte + photos) au bureau' })
  creerRapport(@CurrentUser() user: AuthUser, @Body() dto: CreateRapportDto, @UploadedFiles() photos: UploadedBinary[] | undefined) {
    return this.rapports.create(user, dto, photos ?? []);
  }
}
