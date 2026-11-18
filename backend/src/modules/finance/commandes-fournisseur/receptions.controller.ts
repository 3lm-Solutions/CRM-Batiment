import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, FACTURATION, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';

/** 18/11 (lot B): the installer checks the deliveries of his missions too */
const AVEC_INSTALLATEUR = [...STAFF, Role.SOUS_TRAITANT];
import type { UploadedBinary } from '../../core/storage/upload.config';
import { PositionPhotoDto, QueryReceptionsDto, RefuserReceptionDto } from './commandes.dto';
import { ReceptionsService } from './receptions.service';

/**
 * 18/11 (mobile lot A): deliveries checked against the delivery note (BL).
 * The gaps are sent with POST /commandes-fournisseur/:id/receptions (field `ecarts`).
 */
@ApiTags('Commandes fournisseur')
@ApiBearerAuth()
@Controller('receptions')
export class ReceptionsController {
  constructor(private readonly receptions: ReceptionsService) {}

  @Roles(...FACTURATION)
  @Get()
  @ApiOperation({
    summary:
      'Livraisons reçues (filtre statutControle=A_VERIFIER : onglet « Commandes » des validations)',
  })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryReceptionsDto) {
    return this.receptions.liste(user, query);
  }

  @Roles(...AVEC_INSTALLATEUR)
  @Get(':id')
  @ApiOperation({ summary: 'Une livraison : quantités reçues, écarts, photos du bon de livraison' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.receptions.detail(user, id);
  }

  @Roles(...AVEC_INSTALLATEUR)
  @Post(':id/fichiers')
  @UseInterceptors(FileInterceptor('fichier'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fichier'],
      properties: {
        fichier: { type: 'string', format: 'binary' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @ApiOperation({
    summary: 'Ajouter la photo du bon de livraison ou d’un article manquant / abîmé (image ou PDF)',
  })
  ajouterFichier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PositionPhotoDto,
    @UploadedFile() fichier: UploadedBinary | undefined,
  ) {
    const position =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { latitude: dto.latitude, longitude: dto.longitude }
        : null;
    return this.receptions.ajouterFichier(user, id, fichier, position);
  }

  @Roles(...FACTURATION)
  @Post(':id/valider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter la livraison et ses écarts' })
  valider(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.receptions.valider(user, id);
  }

  @Roles(...FACTURATION)
  @Post(':id/refuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refuser la livraison (motif obligatoire) : l’auteur est prévenu' })
  refuser(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefuserReceptionDto,
  ) {
    return this.receptions.refuser(user, id, dto.motif);
  }
}
