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
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto, QueryClientsDto, UpdateClientDto } from './dto/clients.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@Roles(...BUREAU)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste paginée (actifs par défaut, ?archived=true pour les archivés)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryClientsDto) {
    return this.clients.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche client + dernières demandes, devis et chantiers' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.clients.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clients.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(user, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.clients.archive(user, id);
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  unarchive(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.clients.unarchive(user, id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Suppression définitive — uniquement un client sans historique (sinon archiver)',
  })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.clients.remove(user, id);
  }
}
