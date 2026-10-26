import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { MAX_PHOTOS_IA } from './devis-ia.prompt';
import { DevisIaService } from './devis-ia.service';
import { AppliquerDevisIaDto, ProposerDevisIaDto, ProposerPhotoIaDto } from './dto/devis-ia.dto';

@ApiTags('Devis — assistant IA')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('devis/:devisId/ia')
export class DevisIaController {
  constructor(private readonly service: DevisIaService) {}

  /** Each call may cost an OpenAI request: 20 per minute per client is plenty for a human. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('proposer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Proposer des lignes du catalogue à partir d’une description (rien n’est enregistré)' })
  proposer(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: ProposerDevisIaDto) {
    return this.service.proposer(user, devisId, dto);
  }

  /** Image analysis costs more than text: 10 per minute. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('proposer-photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_IA))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photos'],
      properties: {
        description: { type: 'string' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: MAX_PHOTOS_IA },
      },
    },
  })
  @ApiOperation({ summary: 'Proposer des lignes du catalogue à partir de 1 à 3 photos du chantier (photos non conservées)' })
  proposerPhoto(
    @CurrentUser() user: AuthUser,
    @Param('devisId', ParseIntPipe) devisId: number,
    @Body() dto: ProposerPhotoIaDto,
    @UploadedFiles() photos: UploadedBinary[] | undefined,
  ) {
    return this.service.proposerPhoto(user, devisId, dto.description ?? '', photos);
  }

  @Post('appliquer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajouter au devis les lignes retenues (une seule transaction)' })
  appliquer(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number, @Body() dto: AppliquerDevisIaDto) {
    return this.service.appliquer(user, devisId, dto);
  }
}
