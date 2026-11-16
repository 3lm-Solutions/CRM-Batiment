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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_PHOTOS_PER_RAPPORT, type UploadedBinary } from '../../core/storage/upload.config';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreateRapportChefDto, ReviewRapportDto } from './rapports.dto';
import { RapportsService } from './rapports.service';

/** Same people who run the job site's tasks (ADMIN, ASSISTANTE, CHEF_CHANTIER). */
const REVIEWERS = [Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER];

/** Office / chef side of the sous-traitant site reports. */
@ApiTags('Rapports de chantier')
@Controller()
export class RapportsController {
  constructor(private readonly rapports: RapportsService) {}

  @Roles(...STAFF)
  @Get('chantiers/:chantierId/rapports')
  forChantier(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
  ) {
    return this.rapports.forChantier(user, chantierId);
  }

  @Roles(...REVIEWERS)
  @Post('chantiers/:chantierId/rapports')
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_PER_RAPPORT))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contenu'],
      properties: {
        tacheId: { type: 'integer' },
        contenu: { type: 'string' },
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Chef / bureau : écrire un rapport de chantier (texte + photos)' })
  creerParChef(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Body() dto: CreateRapportChefDto,
    @UploadedFiles() photos: UploadedBinary[] | undefined,
  ) {
    return this.rapports.createParChef(user, chantierId, dto, photos ?? []);
  }

  @Roles(...REVIEWERS)
  @Delete('chantiers/:chantierId/rapports/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer mon rapport (dans les 15 minutes après l’envoi)' })
  supprimerMien(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rapports.supprimerMien(user, chantierId, id);
  }

  @Roles(...REVIEWERS)
  @Post('rapports/:id/valider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider (applique l’avancement déclaré à la tâche)' })
  valider(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewRapportDto,
  ) {
    return this.rapports.review(user, id, 'VALIDE', dto.commentaire);
  }

  @Roles(...REVIEWERS)
  @Post('rapports/:id/rejeter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renvoyer au sous-traitant avec un commentaire' })
  rejeter(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewRapportDto,
  ) {
    return this.rapports.review(user, id, 'REJETE', dto.commentaire);
  }
}
