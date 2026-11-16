import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ALL_ROLES, type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { UploadFichierDto } from './fichiers.dto';
import { FichiersService } from './fichiers.service';
import type { UploadedBinary } from './upload.config';

@ApiTags('Fichiers')
@Controller('fichiers')
export class FichiersController {
  constructor(private readonly fichiers: FichiersService) {}

  /** Office and chef upload here (documents, certificates). Portal accounts upload through their portal routes. */
  @Roles(...STAFF)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' }, chantierId: { type: 'integer' } },
    },
  })
  @ApiOperation({ summary: 'Déposer un fichier (JPG, PNG, WebP, PDF)' })
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedBinary | undefined,
    @Body() dto: UploadFichierDto,
  ) {
    return this.fichiers.create(user, file, { chantierId: dto.chantierId });
  }

  @Roles(...ALL_ROLES)
  @Get(':id')
  meta(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.fichiers.meta(user, id);
  }

  /** Bytes, after the access check. Private cache: never stored by shared proxies. */
  @Roles(...ALL_ROLES)
  @Get(':id/contenu')
  @Header('Cache-Control', 'private, max-age=300')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  )
  download(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.fichiers.download(user, id);
  }
}
