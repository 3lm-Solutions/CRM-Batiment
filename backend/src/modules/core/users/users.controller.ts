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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreateUserDto, QueryUsersDto, UpdateUserDto, UserOptionsQueryDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste paginée des utilisateurs de l’entreprise' })
  findAll(@CurrentUser() admin: AuthUser, @Query() query: QueryUsersDto) {
    return this.users.findAll(admin, query);
  }

  /** Declared BEFORE ':id', otherwise "options" would be parsed as an id */
  @Roles(...STAFF)
  @Get('options')
  @ApiOperation({ summary: 'Liste simplifiée pour les sélecteurs (ex. ?roles=CHEF_CHANTIER)' })
  options(@CurrentUser() user: AuthUser, @Query() query: UserOptionsQueryDto) {
    return this.users.options(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(admin, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer un compte',
    description: 'Génère un mot de passe temporaire et l’envoie par email. Changement obligatoire à la 1re connexion.',
  })
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(admin, dto);
  }

  @Patch(':id')
  update(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(admin, id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver (effet immédiat sur les sessions ouvertes)' })
  deactivate(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.deactivate(admin, id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.activate(admin, id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nouveau mot de passe temporaire (ferme les sessions de l’utilisateur)' })
  resetPassword(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.resetPassword(admin, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression définitive (préférer la désactivation)' })
  remove(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.remove(admin, id);
  }
}
