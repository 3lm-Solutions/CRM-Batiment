import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO)
  @ApiOperation({
    summary: 'Liste des utilisateurs',
    description: 'Retourne tous les utilisateurs de la même entreprise.',
  })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs' })
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un utilisateur" })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Utilisateur trouvé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier un utilisateur (Admin)',
    description:
      'Permet de changer le rôle, nom, téléphone, ou désactiver un utilisateur.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Utilisateur modifié' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Désactiver un utilisateur (soft delete)',
    description: "Met actif=false. L'utilisateur ne pourra plus se connecter.",
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Utilisateur désactivé' })
  @ApiResponse({ status: 403, description: 'Impossible de se désactiver soi-même' })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.deactivate(id, user);
  }

  @Delete(':id/hard')
  @ApiOperation({
    summary: 'Supprimer définitivement un utilisateur',
    description: 'Hard delete — supprime le compte de la base. Impossible sur soi-même ou un autre admin.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé' })
  @ApiResponse({ status: 403, description: 'Action non autorisée' })
  async hardDelete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.hardDelete(id, user);
  }
}
