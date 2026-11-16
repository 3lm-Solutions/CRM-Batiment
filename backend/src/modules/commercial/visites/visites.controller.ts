import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import {
  AnnulerVisiteDto,
  CreateVisiteDto,
  QueryVisitesDto,
  TerminerVisiteDto,
  UpdateVisiteDto,
} from './visites.dto';
import { VisitesService } from './visites.service';

/** 16/11 (mobile lot 1): visites programmées du commercial. */
@ApiTags('Visites')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('visites')
export class VisitesController {
  constructor(private readonly visites: VisitesService) {}

  @Get()
  @ApiOperation({ summary: 'Visites (le commercial : les siennes ; filtres du / au / statut)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryVisitesDto) {
    return this.visites.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Une visite' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.visites.findOne(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Programmer une visite (rappel la veille à 18 h)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVisiteDto) {
    return this.visites.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Déplacer / modifier une visite prévue' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVisiteDto,
  ) {
    return this.visites.update(user, id, dto);
  }

  @Post(':id/faite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Visite faite (compte rendu facultatif)' })
  terminer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TerminerVisiteDto,
  ) {
    return this.visites.terminer(user, id, dto);
  }

  @Post(':id/annuler')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annuler une visite (motif facultatif)' })
  annuler(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnnulerVisiteDto,
  ) {
    return this.visites.annuler(user, id, dto);
  }
}
