import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../../common';
import { InstallationEtape, Role } from '../../../generated/prisma/client';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { InstallateurService } from './installateur.service';
import { pdf } from './installations.controller';
import {
  AvancerDto,
  EnvoyerPvDto,
  MotifDto,
  PhotosEtapeDto,
  ProposerDateDto,
  QueryMissionsDto,
  SignalerDto,
  VerifierPvDto,
} from './installations.dto';

const position = (dto: { latitude?: number; longitude?: number }) =>
  dto.latitude !== undefined && dto.longitude !== undefined
    ? { latitude: dto.latitude, longitude: dto.longitude }
    : null;

/**
 * 18/11 (mobile lot B): « Mes missions » of the installer (a sous-traitant with an account).
 * Only the installations proposed to him; never a price.
 */
@ApiTags('Installateur')
@ApiBearerAuth()
@Roles(Role.SOUS_TRAITANT)
@Controller('installateur')
export class InstallateurController {
  constructor(private readonly missions: InstallateurService) {}

  @Get('missions')
  @ApiOperation({ summary: 'Mes missions (filtre : PROPOSEES, EN_COURS, TERMINEES)' })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryMissionsDto) {
    return this.missions.liste(user, query);
  }

  /** Declared before `missions/:id`. */
  @Get('pv/verifier')
  @ApiOperation({ summary: 'Vérifier le QR code lu sur un PV imprimé' })
  verifierQr(@CurrentUser() user: AuthUser, @Query() query: VerifierPvDto) {
    return this.missions.verifierQr(user, query.contenu);
  }

  @Get('missions/:id')
  @ApiOperation({
    summary: 'Une mission : client, adresse, articles sans prix, dates, livraisons, chronologie',
  })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.missions.detail(user, id);
  }

  @Post('missions/:id/accepter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter la mission (le bureau est prévenu)' })
  accepter(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.missions.accepter(user, id);
  }

  @Post('missions/:id/refuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refuser la mission (motif obligatoire, le bureau est prévenu)' })
  refuser(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotifDto,
  ) {
    return this.missions.refuser(user, id, dto.motif);
  }

  @Post('missions/:id/dates/confirmer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmer la date souhaitée par le bureau' })
  confirmerDate(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.missions.confirmerDate(user, id);
  }

  @Post('missions/:id/dates/proposer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Proposer une autre date (le bureau l’accepte)' })
  proposerDate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProposerDateDto,
  ) {
    return this.missions.proposerDate(user, id, new Date(dto.date));
  }

  @Post('missions/:id/etapes/:etape/photos')
  @UseInterceptors(FilesInterceptor('photos', 10))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photos'],
      properties: {
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @ApiOperation({ summary: 'Photos de l’étape en cours (LIVRAISON, POSE, FINITIONS)' })
  photos(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('etape', new ParseEnumPipe(InstallationEtape)) etape: InstallationEtape,
    @Body() dto: PhotosEtapeDto,
    @UploadedFiles() photos: UploadedBinary[] | undefined,
  ) {
    return this.missions.ajouterPhotos(user, id, etape, photos, position(dto));
  }

  @Post('missions/:id/avancer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Passer à l’étape suivante (Pose, puis Finitions) — une photo de l’étape au moins',
  })
  avancer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AvancerDto,
  ) {
    return this.missions.avancer(user, id, dto.etape);
  }

  @Post('missions/:id/signalements')
  @UseInterceptors(FilesInterceptor('photos', 10))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'description'],
      properties: {
        type: { type: 'string', enum: ['RESERVE', 'RETARD', 'INCIDENT'] },
        description: { type: 'string' },
        savDemande: { type: 'boolean' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({
    summary: 'Signaler une réserve, un retard ou un incident (le bureau est prévenu)',
  })
  signaler(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignalerDto,
    @UploadedFiles() photos: UploadedBinary[] | undefined,
  ) {
    return this.missions.signaler(user, id, dto, photos);
  }

  @Get('missions/:id/pv')
  @ApiOperation({ summary: 'PV de fin de travaux à imprimer (PDF avec QR code)' })
  async pdfPv(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return pdf(await this.missions.pdfPv(user, id), `PV-mission-${id}`);
  }

  @Post('missions/:id/pv')
  @UseInterceptors(FileInterceptor('fichier'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fichier'],
      properties: {
        fichier: { type: 'string', format: 'binary' },
        qrContenu: { type: 'string', description: 'Vide si le QR est illisible' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @ApiOperation({
    summary: 'Envoyer le PV signé scanné : QR bon → terminé ; sans QR → à vérifier par le bureau',
  })
  envoyerPv(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnvoyerPvDto,
    @UploadedFile() fichier: UploadedBinary | undefined,
  ) {
    return this.missions.envoyerPv(user, id, fichier, dto.qrContenu, position(dto));
  }
}
