import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreateTypeProjetDto, QueryTypesProjetDto, UpdateTypeProjetDto } from './dto/types-projet.dto';
import { TypesProjetService } from './types-projet.service';

@ApiTags('Types de projet')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('types-projet')
export class TypesProjetController {
  constructor(private readonly typesProjet: TypesProjetService) {}

  @Roles(...STAFF)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTypesProjetDto) {
    return this.typesProjet.findAll(user, query);
  }

  @Roles(...STAFF)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.typesProjet.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTypeProjetDto) {
    return this.typesProjet.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTypeProjetDto) {
    return this.typesProjet.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.typesProjet.remove(user, id);
  }
}
