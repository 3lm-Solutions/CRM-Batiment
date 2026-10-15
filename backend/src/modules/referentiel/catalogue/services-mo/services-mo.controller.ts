import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import { CreateServiceMoDto, QueryServicesMoDto, UpdateServiceMoDto } from './services-mo.dto';
import { ServicesMoService } from './services-mo.service';

@ApiTags('Catalogue — main d’œuvre')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('catalogue/services-mo')
export class ServicesMoController {
  constructor(private readonly services: ServicesMoService) {}

  @Roles(...STAFF)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryServicesMoDto) {
    return this.services.findAll(user, query);
  }

  @Roles(...STAFF)
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.services.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceMoDto) {
    return this.services.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceMoDto) {
    return this.services.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.services.remove(user, id);
  }
}
