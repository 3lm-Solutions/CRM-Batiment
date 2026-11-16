import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreatePublicDemoRequestDto } from './dto/create-demo-request.dto.js';
import { QueryDemoRequestDto } from './dto/query-demo-request.dto.js';
import { UpdateDemoRequestDto } from './dto/update-demo-request.dto.js';
import { DemoRequestsService } from './demo-requests.service.js';

@ApiTags('Demandes de demo')
@Controller('demo-requests')
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post('public')
  @ApiOperation({ summary: 'Créer une demande de démo depuis le formulaire public' })
  @ApiResponse({ status: 201, description: 'Demande de démo enregistrée.' })
  createPublic(@Body() dto: CreatePublicDemoRequestDto) {
    return this.demoRequestsService.createPublic(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({ summary: 'Liste back-office des demandes de démo' })
  findAll(
    @Query() query: QueryDemoRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.demoRequestsService.findAll(query, user);
  }

  @Get('summary')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({ summary: 'Résumé des demandes de démo' })
  getSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.demoRequestsService.getSummary(user);
  }

  @Get('assignees')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({ summary: 'Lister les utilisateurs pouvant prendre en charge une démo' })
  getAssignees(@CurrentUser() user: CurrentUserPayload) {
    return this.demoRequestsService.getAssignees(user);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({ summary: 'Détail d’une demande de démo' })
  @ApiParam({ name: 'id', type: Number })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.demoRequestsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({ summary: 'Modifier le statut ou la planification d’une demande de démo' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDemoRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.demoRequestsService.update(id, dto, user);
  }
}
