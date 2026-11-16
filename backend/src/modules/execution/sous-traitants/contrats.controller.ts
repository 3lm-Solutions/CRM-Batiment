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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { amountsFor, type AuthUser, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { ContratsService } from './contrats.service';
import { CreateContratDto, UpdateContratDto } from './dto/sous-traitants.dto';

@ApiTags('Sous-traitants — contrats')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('contrats-sous-traitance')
export class ContratsController {
  constructor(private readonly contrats: ContratsService) {}

  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @Get()
  @ApiQuery({ name: 'sousTraitantId', required: false })
  @ApiQuery({ name: 'chantierId', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('sousTraitantId', new ParseIntPipe({ optional: true })) sousTraitantId?: number,
    @Query('chantierId', new ParseIntPipe({ optional: true })) chantierId?: number,
  ) {
    return amountsFor(user, this.contrats.findAll(user, { sousTraitantId, chantierId }));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContratDto) {
    return this.contrats.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContratDto,
  ) {
    return this.contrats.update(user, id, dto);
  }

  @Post(':id/activer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer (exige une décennale en cours de validité)' })
  activer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contrats.transition(user, id, 'ACTIF');
  }

  @Post(':id/terminer')
  @HttpCode(HttpStatus.OK)
  terminer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contrats.transition(user, id, 'TERMINE');
  }

  @Post(':id/resilier')
  @HttpCode(HttpStatus.OK)
  resilier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contrats.transition(user, id, 'RESILIE');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.contrats.remove(user, id);
  }
}
