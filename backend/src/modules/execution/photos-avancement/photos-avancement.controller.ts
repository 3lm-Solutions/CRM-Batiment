import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { EnvoyerPhotosDto, MasquerPhotosDto, PhotosIdsDto, QueryMesPhotosDto, QueryPhotosChantierDto } from './photos-avancement.dto';
import { PhotosAvancementService } from './photos-avancement.service';
import { MAX_PHOTOS_ENVOI } from './photos-rules';

/** Who validates / hides photos: the operational roles (same as the tasks); the TECHNICO only looks. */
const VALIDATION = [Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER];

/** Office and chef (his job sites): before / after photos of the tasks (Étapes 3–4 of 26/10). */
@ApiTags('Photos d’avancement')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('chantiers/:chantierId/photos')
export class PhotosChantierController {
  constructor(private readonly photos: PhotosAvancementService) {}

  @Get()
  @ApiOperation({ summary: 'Photos avant / après du chantier (filtres tâche, sous-tâche, auteur, statut, période)' })
  liste(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Query() query: QueryPhotosChantierDto) {
    return this.photos.liste(user, chantierId, query);
  }

  @Roles(...VALIDATION)
  @Post('valider') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider des photos (visibles ensuite par le client)' })
  valider(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Body() dto: PhotosIdsDto) {
    return this.photos.valider(user, chantierId, dto.ids);
  }

  @Roles(...VALIDATION)
  @Post('masquer') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Masquer des photos (jamais montrées au client ; le motif est montré au sous-traitant)' })
  masquer(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number, @Body() dto: MasquerPhotosDto) {
    return this.photos.masquer(user, chantierId, dto);
  }
}

/** The sous-traitant sends his photos of the day from his portal. */
@ApiTags('Portail sous-traitant')
@Roles(Role.SOUS_TRAITANT)
@Controller('portail/sous-traitant/photos')
export class PortailPhotosController {
  constructor(private readonly photos: PhotosAvancementService) {}

  @Get()
  mesPhotos(@CurrentUser() user: AuthUser, @Query() query: QueryMesPhotosDto) {
    return this.photos.mesPhotos(user, query);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_ENVOI))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tacheId', 'moment', 'photos'],
      properties: {
        tacheId: { type: 'integer' },
        checklistItemId: { type: 'integer' },
        moment: { type: 'string', enum: ['AVANT', 'APRES'] },
        date: { type: 'string', format: 'date' },
        commentaire: { type: 'string' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Envoyer des photos avant / après d’une tâche (JPEG, PNG, WebP ; 10 au plus)' })
  envoyer(@CurrentUser() user: AuthUser, @Body() dto: EnvoyerPhotosDto, @UploadedFiles() photos: UploadedBinary[] | undefined) {
    return this.photos.envoyer(user, dto, photos);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une de mes photos pas encore validée' })
  supprimer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.photos.supprimerMienne(user, id);
  }
}
