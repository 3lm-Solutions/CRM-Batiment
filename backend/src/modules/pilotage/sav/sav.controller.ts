import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { CreateSavTicketDto, QuerySavDto, ResoudreSavDto, SavNoteDto, UpdateSavTicketDto } from './sav.dto';
import { SavService } from './sav.service';

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
