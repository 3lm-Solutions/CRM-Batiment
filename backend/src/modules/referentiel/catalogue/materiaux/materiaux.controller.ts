import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, costsFor, CurrentUser, Roles, STAFF } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import { CreateMateriauDto, QueryMateriauxDto, UpdateMateriauDto } from './materiaux.dto';
import { MateriauxService } from './materiaux.service';

@ApiTags('Catalogue — matériaux')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('catalogue/materiaux')
export class MateriauxController {
  constructor(private readonly materiaux: MateriauxService) {}

  @Roles(...STAFF)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryMateriauxDto) {
    return costsFor(user, this.materiaux.findAll(user, query));
  }

  @Roles(...STAFF)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return costsFor(user, this.materiaux.findOne(user, id));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMateriauDto) {
    return this.materiaux.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier (un changement de prix est historisé)' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMateriauDto) {
    return this.materiaux.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression (409 si utilisé dans un devis ou une composition — désactiver plutôt)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.materiaux.remove(user, id);
  }
}
