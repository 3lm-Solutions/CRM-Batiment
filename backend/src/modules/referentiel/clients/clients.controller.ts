import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AuthUser, BUREAU, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { ClientsService } from './clients.service';
import {
  CreateClientDto,
  DoublonsClientQueryDto,
  QueryClientsDto,
  UpdateClientDto,
} from './dto/clients.dto';

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

  /** 16/11 (mobile): declared before `:id`. The chef only gets names and statuses. */
  @Roles(...STAFF)
  @Get('doublons')
  @ApiOperation({ summary: 'Clients existants avec le même téléphone ou le même email' })
  doublons(@CurrentUser() user: AuthUser, @Query() query: DoublonsClientQueryDto) {
    return this.clients.chercherDoublons(user.companyId, query, user.role !== Role.CHEF_CHANTIER);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche client + dernières demandes, devis et chantiers' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.clients.findOne(user, id);
  }

  @Post()
  @ApiQuery({
    name: 'verifierDoublons',
    required: false,
    description: 'true (mobile) : 409 CLIENT_EXISTANT si le téléphone ou l’email existe déjà',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClientDto,
    @Query('verifierDoublons', new ParseBoolPipe({ optional: true })) verifierDoublons?: boolean,
  ) {
    return this.clients.create(user, dto, verifierDoublons ?? false);
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
