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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { amountsFor, type AuthUser, CurrentUser, FACTURATION, Roles, STAFF } from '../../../common';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { PositionPhotoDto } from '../commandes-fournisseur/commandes.dto';
import {
  CHAMPS_OCR,
  CreerDepenseDto,
  ModifierDepenseDto,
  QueryDepensesDto,
  RefuserDepenseDto,
} from './depenses.dto';
import { DepensesService } from './depenses.service';

const position = (dto: { latitude?: number; longitude?: number }) =>
  dto.latitude !== undefined && dto.longitude !== undefined
    ? { latitude: dto.latitude, longitude: dto.longitude }
    : null;

/**
 * 18/11 (mobile lot A): supplier invoices photographed in the field.
 * Every answer goes through amountsFor: a chef de chantier never reads an amount.
 */
@ApiTags('Dépenses')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('depenses')
export class DepensesController {
  constructor(private readonly depenses: DepensesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('fichier'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'fichier',
        'numeroFacture',
        'dateFacture',
        'montantHT',
        'montantTVA',
        'montantTTC',
      ],
      properties: {
        fichier: { type: 'string', format: 'binary', description: 'Photo ou PDF de la facture' },
        fournisseurId: { type: 'integer' },
        fournisseurNom: { type: 'string' },
        numeroFacture: { type: 'string' },
        dateFacture: { type: 'string', example: '2026-11-17' },
        montantHT: { type: 'number' },
        montantTVA: { type: 'number' },
        montantTTC: { type: 'number' },
        chantierId: { type: 'integer' },
        commandeFournisseurId: { type: 'integer' },
        champsDouteux: { type: 'string', example: CHAMPS_OCR.slice(3).join(',') },
        notes: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Envoyer une facture fournisseur lue sur le téléphone : dépense en brouillon, le bureau est prévenu',
  })
  creer(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreerDepenseDto,
    @UploadedFile() fichier: UploadedBinary | undefined,
  ) {
    return amountsFor(user, this.depenses.creer(user, dto, fichier));
  }

  @Get()
  @ApiOperation({ summary: 'Dépenses (le chef : les siennes, sans montants)' })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryDepensesDto) {
    return amountsFor(user, this.depenses.liste(user, query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Une dépense avec ses photos' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return amountsFor(user, this.depenses.detail(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Corriger une dépense encore en brouillon' })
  modifier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModifierDepenseDto,
  ) {
    return amountsFor(user, this.depenses.modifier(user, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une dépense encore en brouillon (et ses photos)' })
  supprimer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.depenses.supprimer(user, id);
  }

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
  @ApiOperation({ summary: 'Ajouter une page de la facture (brouillon seulement)' })
  ajouterFichier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PositionPhotoDto,
    @UploadedFile() fichier: UploadedBinary | undefined,
  ) {
    return this.depenses.ajouterFichier(user, id, fichier, position(dto));
  }

  @Roles(...FACTURATION)
  @Post(':id/valider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider la dépense (onglet « Factures » des validations)' })
  valider(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.depenses.valider(user, id);
  }

  @Roles(...FACTURATION)
  @Post(':id/refuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refuser la dépense (motif obligatoire) : l’auteur est prévenu' })
  refuser(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefuserDepenseDto,
  ) {
    return this.depenses.refuser(user, id, dto.motif);
  }
}
