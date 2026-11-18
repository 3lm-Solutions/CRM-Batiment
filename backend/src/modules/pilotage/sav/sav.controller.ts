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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, SAV_ACCES, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import type { UploadedBinary } from '../../core/storage/upload.config';
import {
  CreateSavTicketDto,
  QuerySavDto,
  RejeterSavDto,
  ResoudreSavDto,
  SavChantiersQueryDto,
  SavDoublonsQueryDto,
  SavNoteDto,
  UpdateSavTicketDto,
} from './sav.dto';
import { MAX_PHOTOS_PAR_TICKET, SavService } from './sav.service';

@ApiTags('SAV')
@ApiBearerAuth()
@Roles(...SAV_ACCES)
@Controller('sav')
export class SavController {
  constructor(private readonly sav: SavService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QuerySavDto) {
    return this.sav.findAll(user, query);
  }

  /** Before ':id'. Étape 2 (26/10): which job sites of the client can receive a ticket. */
  @Get('chantiers')
  @ApiOperation({
    summary: 'Chantiers du client et possibilité d’ouvrir un SAV (chantier terminé, dans le délai)',
  })
  chantiers(@CurrentUser() user: AuthUser, @Query() query: SavChantiersQueryDto) {
    return this.sav.chantiersEligibles(user, query.clientId);
  }

  /** Before ':id'. Open tickets of the same client / job site (duplicate warning). */
  @Get('doublons')
  @ApiOperation({ summary: 'Tickets encore ouverts pour ce client / chantier (détection des doublons)' })
  doublons(@CurrentUser() user: AuthUser, @Query() query: SavDoublonsQueryDto) {
    return this.sav.doublons(user, query.clientId, query.chantierId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSavTicketDto) {
    return this.sav.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSavTicketDto,
  ) {
    return this.sav.update(user, id, dto);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SavNoteDto,
  ) {
    return this.sav.addNote(user, id, dto);
  }

  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_PAR_TICKET))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photos: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @ApiOperation({ summary: 'Ajouter des photos au ticket (JPEG, PNG, WebP)' })
  ajouterPhotos(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() photos: UploadedBinary[] | undefined,
  ) {
    return this.sav.ajouterPhotos(user, id, photos);
  }

  @Delete(':id/photos/:fichierId')
  @HttpCode(HttpStatus.NO_CONTENT)
  supprimerPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('fichierId', ParseIntPipe) fichierId: number,
  ) {
    return this.sav.supprimerPhoto(user, id, fichierId);
  }

  @Post(':id/qualifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ticket du client vérifié : À qualifier → Ouvert' })
  qualifier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'OUVERT');
  }

  @Post(':id/planifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Intervention prévue : → Planifié (note facultative)' })
  planifier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResoudreSavDto,
  ) {
    return this.sav.transition(user, id, 'PLANIFIE', dto);
  }

  // A rejection is a decision of a responsable, not of the AGENT_SAV (CDC 3 and 4.4)
  @Roles(...STAFF, Role.RESPONSABLE_SAV)
  @Post(':id/rejeter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeter le ticket, avec un motif envoyé au client' })
  rejeter(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejeterSavDto,
  ) {
    return this.sav.transition(user, id, 'REJETE', { note: dto.motif, visibleClient: true });
  }

  @Post(':id/prendre-en-charge')
  @HttpCode(HttpStatus.OK)
  prendre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'EN_COURS');
  }

  @Post(':id/attente-client')
  @HttpCode(HttpStatus.OK)
  attente(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'EN_ATTENTE_CLIENT');
  }

  @Post(':id/resoudre')
  @HttpCode(HttpStatus.OK)
  resoudre(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResoudreSavDto,
  ) {
    return this.sav.transition(user, id, 'RESOLU', dto);
  }

  // The AGENT_SAV may resolve; closing / reopening is checked by a responsable (CDC 3)
  @Roles(...STAFF, Role.RESPONSABLE_SAV)
  @Post(':id/rouvrir')
  @HttpCode(HttpStatus.OK)
  rouvrir(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'EN_COURS');
  }

  @Roles(...STAFF, Role.RESPONSABLE_SAV)
  @Post(':id/cloturer')
  @HttpCode(HttpStatus.OK)
  cloturer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'CLOTURE');
  }
}
