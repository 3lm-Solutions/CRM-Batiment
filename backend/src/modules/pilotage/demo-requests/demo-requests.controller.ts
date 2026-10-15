import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser, Public, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreateDemoRequestDto, PlanifierDemoDto, QueryDemoRequestsDto, UpdateDemoRequestDto } from './demo-requests.dto';
import { DemoRequestsService } from './demo-requests.service';

@ApiTags('Demandes de démo — formulaire public')
@Public()
@Controller('public/demo-requests')
export class PublicDemoRequestsController {
  constructor(private readonly demo: DemoRequestsService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Formulaire « Demander une démo » (limité, anti-robot)' })
  create(@Body() dto: CreateDemoRequestDto) {
    return this.demo.createPublic(dto);
  }
}

@ApiTags('Demandes de démo')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.TECHNICO)
@Controller('demo-requests')
export class DemoRequestsController {
  constructor(private readonly demo: DemoRequestsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDemoRequestsDto) {
    return this.demo.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demo.findOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDemoRequestDto) {
    return this.demo.update(user, id, dto);
  }

  @Post(':id/contacter') @HttpCode(HttpStatus.OK)
  contacter(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demo.transition(user, id, 'CONTACTED');
  }

  @Post(':id/planifier') @HttpCode(HttpStatus.OK)
  planifier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PlanifierDemoDto) {
    return this.demo.transition(user, id, 'SCHEDULED', dto.dateDemo);
  }

  @Post(':id/terminer') @HttpCode(HttpStatus.OK)
  terminer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demo.transition(user, id, 'DONE');
  }

  @Post(':id/annuler') @HttpCode(HttpStatus.OK)
  annuler(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.demo.transition(user, id, 'CANCELED');
  }
}
