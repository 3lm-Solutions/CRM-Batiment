import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { CreateSavTicketDto, QuerySavDto, ResoudreSavDto, SavNoteDto, UpdateSavTicketDto } from './sav.dto';
import { MAX_PHOTOS_PAR_TICKET, SavService } from './sav.service';

@ApiTags('SAV')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('sav')
export class SavController {
  constructor(private readonly sav: SavService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QuerySavDto) {
    return this.sav.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSavTicketDto) {
    return this.sav.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSavTicketDto) {
    return this.sav.update(user, id, dto);
  }

  @Post(':id/notes')
  addNote(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SavNoteDto) {
    return this.sav.addNote(user, id, dto);
  }

  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS_PAR_TICKET))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Ajouter des photos au ticket (JPEG, PNG, WebP)' })
  ajouterPhotos(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @UploadedFiles() photos: UploadedBinary[] | undefined) {
    return this.sav.ajouterPhotos(user, id, photos);
  }

  @Delete(':id/photos/:fichierId') @HttpCode(HttpStatus.NO_CONTENT)
  supprimerPhoto(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('fichierId', ParseIntPipe) fichierId: number) {
    return this.sav.supprimerPhoto(user, id, fichierId);
  }

  @Post(':id/prendre-en-charge') @HttpCode(HttpStatus.OK)
  prendre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'EN_COURS');
  }

  @Post(':id/attente-client') @HttpCode(HttpStatus.OK)
  attente(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'EN_ATTENTE_CLIENT');
  }

  @Post(':id/resoudre') @HttpCode(HttpStatus.OK)
  resoudre(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResoudreSavDto) {
    return this.sav.transition(user, id, 'RESOLU', dto);
  }

  @Post(':id/rouvrir') @HttpCode(HttpStatus.OK)
  rouvrir(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'EN_COURS');
  }

  @Post(':id/cloturer') @HttpCode(HttpStatus.OK)
  cloturer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.sav.transition(user, id, 'CLOTURE');
  }
}
