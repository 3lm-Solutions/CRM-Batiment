import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreatePointageDto, QueryMesPointagesDto, QueryPointagesDto, RefuserPointageDto, ValiderPointagesDto } from './pointages.dto';
import { PointagesService } from './pointages.service';

/** Office and chef (his job sites): hours of the sous-traitants to validate (21/10). */
@ApiTags('Pointages')
@ApiBearerAuth()
@Roles(...STAFF)
@Controller('pointages')
export class PointagesController {
  constructor(private readonly pointages: PointagesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryPointagesDto) {
    return this.pointages.findAll(user, query);
  }

  @Get('resume/:sousTraitantId')
  @ApiOperation({ summary: 'Heures d’un sous-traitant par chantier (validées / en attente)' })
  resume(@CurrentUser() user: AuthUser, @Param('sousTraitantId', ParseIntPipe) sousTraitantId: number) {
    return this.pointages.resume(user, sousTraitantId);
  }

  @Post('valider') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider des pointages en attente (plusieurs à la fois)' })
  valider(@CurrentUser() user: AuthUser, @Body() dto: ValiderPointagesDto) {
    return this.pointages.valider(user, dto.ids);
  }

  @Post(':id/refuser') @HttpCode(HttpStatus.OK)
  refuser(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: RefuserPointageDto) {
    return this.pointages.refuser(user, id, dto);
  }
}

/** The sous-traitant enters his own hours in his portal. */
@ApiTags('Portail sous-traitant')
@Roles(Role.SOUS_TRAITANT)
@Controller('portail/sous-traitant/pointages')
export class PortailPointagesController {
  constructor(private readonly pointages: PointagesService) {}

  @Get()
  mesPointages(@CurrentUser() user: AuthUser, @Query() query: QueryMesPointagesDto) {
    return this.pointages.mesPointages(user, query.mois);
  }

  @Post()
  @ApiOperation({ summary: 'Pointer des heures (un jour, un chantier ouvert à mon compte)' })
  pointer(@CurrentUser() user: AuthUser, @Body() dto: CreatePointageDto) {
    return this.pointages.pointer(user, dto);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  supprimer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.pointages.supprimerMien(user, id);
  }
}
