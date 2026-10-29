import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { QueryPrixMarcheDto } from './prix-marche.dto';
import { PrixMarcheService } from './prix-marche.service';

/**
 * Prix de marché (29/10). Office only: the chef de chantier never sees an amount; the price list
 * (CSV) is the Admin's.
 */
@ApiTags('Prix de marché')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('prix-marche')
export class PrixMarcheController {
  constructor(private readonly service: PrixMarcheService) {}

  @Get()
  @ApiOperation({
    summary:
      'Prestations ou matériaux du catalogue avec leur prix de marché (devis signés, commandes, barème)',
  })
  liste(@CurrentUser() user: AuthUser, @Query() query: QueryPrixMarcheDto) {
    return this.service.liste(user, query);
  }

  @Get('devis/:devisId')
  @ApiOperation({
    summary: 'Prix de marché de chaque ligne catalogue d’un devis, et position de son prix',
  })
  pourDevis(@CurrentUser() user: AuthUser, @Param('devisId', ParseIntPipe) devisId: number) {
    return this.service.pourDevis(user, devisId);
  }

  @Roles(Role.ADMIN)
  @Get('bareme')
  @ApiOperation({ summary: 'Barème importé : nombre de lignes, date du dernier import' })
  infoBareme(@CurrentUser() user: AuthUser) {
    return this.service.infoBareme(user);
  }

  @Roles(Role.ADMIN)
  @Get('bareme/modele')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="prix-de-marche.csv"')
  @ApiOperation({ summary: 'Modèle CSV à remplir (catalogue actif + barème actuel)' })
  modele(@CurrentUser() user: AuthUser) {
    return this.service.modeleCsv(user);
  }

  @Roles(Role.ADMIN)
  @Post('bareme/import')
  @UseInterceptors(FileInterceptor('fichier'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fichier'],
      properties: { fichier: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Importer le barème (CSV) — remplace le barème actuel' })
  importer(@CurrentUser() user: AuthUser, @UploadedFile() fichier: UploadedBinary | undefined) {
    return this.service.importer(user, fichier);
  }

  @Roles(Role.ADMIN)
  @Delete('bareme')
  @ApiOperation({ summary: 'Vider le barème importé' })
  vider(@CurrentUser() user: AuthUser) {
    return this.service.viderBareme(user);
  }
}
