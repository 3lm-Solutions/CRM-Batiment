import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TypesProjetService } from './types-projet.service.js';
import { CreateTypeProjetDto } from './dto/create-type-projet.dto.js';
import { UpdateTypeProjetDto } from './dto/update-type-projet.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Types de Projet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE) // <-- AJOUTEE : restrict access to these roles for all endpoints in this controller
@Controller('types-projet')
export class TypesProjetController {
  constructor(private readonly service: TypesProjetService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un type de projet (Admin)' })
  @ApiResponse({ status: 201, description: 'Type de projet créé' })
  create(
    @Body() dto: CreateTypeProjetDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Liste des types de projet' })
  @ApiResponse({ status: 200, description: 'Liste des types de projet actifs' })
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: "Détail d'un type de projet" })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier un type de projet (Admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTypeProjetDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer définitivement un type de projet (Admin)',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.remove(id, user);
  }
}
