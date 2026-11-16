import {
  Body,
  Controller,
  Delete,
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
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { AjouterFichierDemandeDto } from '../../commercial/demandes-devis/dto/demandes-devis.dto';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { CreerProspectTerrainDto, QueryProspectsTerrainDto } from './prospects-terrain.dto';
import { ProspectsTerrainService } from './prospects-terrain.service';

/** 16/11 (mobile lot 1): contacts met on a job site, sent to the sales team. */
@ApiTags('Mobile')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('prospects-terrain')
export class ProspectsTerrainController {
  constructor(private readonly prospects: ProspectsTerrainService) {}

  @Post()
  @ApiOperation({
    summary:
      'Envoyer un prospect rencontré sur le terrain (nouveau contact ou client existant) : les commerciaux sont prévenus',
  })
  creer(@CurrentUser() user: AuthUser, @Body() dto: CreerProspectTerrainDto) {
    return this.prospects.creer(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Mes prospects envoyés et où ils en sont (le bureau voit tout)' })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryProspectsTerrainDto) {
    return this.prospects.liste(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Un de mes prospects envoyés' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.prospects.detail(user, id);
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
        dureeSecondes: { type: 'integer' },
      },
    },
  })
  @ApiOperation({ summary: 'Ajouter une photo ou une note vocale au prospect' })
  ajouterFichier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjouterFichierDemandeDto,
    @UploadedFile() fichier: UploadedBinary | undefined,
  ) {
    return this.prospects.ajouterFichier(user, id, fichier, dto.dureeSecondes);
  }

  @Delete(':id/fichiers/:pieceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer une photo ou une note vocale' })
  supprimerFichier(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('pieceId', ParseIntPipe) pieceId: number,
  ) {
    return this.prospects.supprimerFichier(user, id, pieceId);
  }
}
