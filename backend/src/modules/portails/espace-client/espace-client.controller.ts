import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, BUREAU, CurrentUser, Public, Roles } from '../../../common';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { MAX_PHOTOS_CLIENT } from '../../pilotage/sav/sav.service';
import { CreateRetourClientDto } from '../../pilotage/retours-client/retours-client.dto';
import { CreateSavClientDto, NoteSavClientDto } from './espace-client.dto';
import { EspaceClientService } from './espace-client.service';

const READ = { default: { limit: 60, ttl: 60_000 } };
const WRITE = { default: { limit: 5, ttl: 60_000 } };
/** A gallery loads many thumbnails at once (26/10) */
const IMAGES = { default: { limit: 300, ttl: 60_000 } };

/** Office: send / list / revoke the link of a client's online space. */
@ApiTags('Espace client')
@Roles(...BUREAU)
@Controller('clients/:clientId/espace')
export class EspaceClientAdminController {
  constructor(private readonly espace: EspaceClientService) {}

  @Post('lien')
  @ApiOperation({ summary: 'Envoyer au client le lien de son espace (les liens précédents sont désactivés)' })
  envoyer(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.envoyerLien(user, clientId);
  }

  @Get('liens')
  liens(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.liens(user, clientId);
  }

  @Get('apercu')
  @ApiOperation({ summary: 'Voir l’espace du client tel qu’il le voit (lecture seule, sans lien)' })
  apercu(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.apercu(user, clientId);
  }

  @Get('apercu/devis/:id')
  apercuDevis(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.espace.apercuDevis(user, clientId, id);
  }

  @Get('apercu/factures/:id')
  apercuFacture(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.espace.apercuFacture(user, clientId, id);
  }

  @Get('apercu/photos/:fichierId')
  apercuPhoto(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number, @Param('fichierId', ParseIntPipe) fichierId: number) {
    return this.espace.apercuPhoto(user, clientId, fichierId);
  }

  @Get('apercu/avancement/:photoId')
  apercuPhotoAvancement(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number, @Param('photoId', ParseIntPipe) photoId: number) {
    return this.espace.apercuPhotoAvancement(user, clientId, photoId);
  }

  @Delete('liens') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver tous les liens de ce client' })
  revoquer(@CurrentUser() user: AuthUser, @Param('clientId', ParseIntPipe) clientId: number) {
    return this.espace.revoquer(user, clientId);
  }
}

/** The client's page, opened from the email. No authentication: the token is the credential. */
@ApiTags('Espace client (public)')
@Public()
@Controller('public/espace-client/:token')
export class EspaceClientPublicController {
  constructor(private readonly espace: EspaceClientService) {}

  @Throttle(READ)
  @Get()
  view(@Param('token') token: string) {
    return this.espace.view(token);
  }

  @Throttle(READ)
  @Get('devis/:id')
  devis(@Param('token') token: string, @Param('id', ParseIntPipe) id: number) {
    return this.espace.devis(token, id);
  }

  @Throttle(READ)
  @Get('factures/:id')
  facture(@Param('token') token: string, @Param('id', ParseIntPipe) id: number) {
    return this.espace.facture(token, id);
  }

  @Throttle(WRITE)
  @Post('sav')
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_CLIENT))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['titre', 'description', 'chantierId'],
      properties: {
        titre: { type: 'string' },
        description: { type: 'string' },
        chantierId: { type: 'integer' },
        categorie: { type: 'string' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: MAX_PHOTOS_CLIENT },
      },
    },
  })
  @ApiOperation({ summary: 'Signaler un problème, avec photos si besoin (ouvre un ticket SAV)' })
  ouvrirSav(@Param('token') token: string, @Body() dto: CreateSavClientDto, @UploadedFiles() photos: UploadedBinary[] | undefined) {
    return this.espace.ouvrirSav(token, dto, photos ?? []);
  }

  @Throttle(IMAGES)
  @Get('avancement/:photoId')
  @ApiOperation({ summary: 'Une photo avant / après validée d’un de vos chantiers' })
  photoAvancement(@Param('token') token: string, @Param('photoId', ParseIntPipe) photoId: number) {
    return this.espace.photoAvancement(token, photoId);
  }

  @Throttle(WRITE)
  @Post('retours')
  @ApiOperation({ summary: 'Commenter une tâche / une photo, ou signaler un problème (alerte) pendant les travaux' })
  envoyerRetour(@Param('token') token: string, @Body() dto: CreateRetourClientDto) {
    return this.espace.envoyerRetour(token, dto);
  }

  @Throttle(READ)
  @Get('photos/:fichierId')
  @ApiOperation({ summary: 'Une photo d’un de vos tickets SAV' })
  photo(@Param('token') token: string, @Param('fichierId', ParseIntPipe) fichierId: number) {
    return this.espace.photo(token, fichierId);
  }

  @Throttle(WRITE)
  @Post('sav/:id/messages')
  repondre(@Param('token') token: string, @Param('id', ParseIntPipe) id: number, @Body() dto: NoteSavClientDto) {
    return this.espace.repondreSav(token, id, dto.contenu);
  }
}
