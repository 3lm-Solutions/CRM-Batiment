import {
  Controller,
  Post,
  Param,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Body,
  Get,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam
} from '@nestjs/swagger';
import { DemandesDevisService } from './demandes-devis.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role } from '../../generated/prisma/client.js';
import { CreateDemandeDevisDto } from './dto/create-demande-devis.dto.js';
import { UpdateDemandeDevisDto } from './dto/update-demande-devis.dto.js';
import { QueryDemandeDevisDto } from './dto/query-demande-devis.dto.js';
import { UpdateStatutDto } from './dto/update-statut.dto.js';

@ApiTags('Demandes de Devis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TECHNICO', 'ASSISTANTE')
@Controller('demandes-devis')
export class DemandesDevisController {
  constructor(private readonly service: DemandesDevisService) {}

  @Post(':id/convert')
  @Roles(Role.ADMIN, Role.TECHNICO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'P0.1 : Transformer une demande en devis éditable',
    description:
      'Crée un nouveau devis en statut BROUILLON avec les informations de la demande et du client.',
  })
  @ApiResponse({
    status: 201,
    description: 'Devis créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'La demande a déjà été convertie ou est invalide',
  })
  @ApiResponse({
    status: 404,
    description: 'Demande introuvable',
  })
  async convertToDevis(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.convertToDevis(id, user.userId, user.companyId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  create(@Body() dto: CreateDemandeDevisDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.create(dto, user.userId, user.companyId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  findAll(@Query() query: QueryDemandeDevisDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDemandeDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.update(id, dto, user.companyId);
  }

  @Patch(':id/statut')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  updateStatut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatutDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateStatut(id, dto, user.userId, user.companyId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TECHNICO)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.service.remove(id, user.companyId);
  }



  /* ───────── POST /:id/convertir-en-devis ───────── */
@Post(':id/convertir-en-devis')
@Roles('ADMIN', 'TECHNICO')
@ApiOperation({ summary: 'Convertir une demande de devis en devis éditable (BROUILLON)' })
@ApiParam({ name: 'id', type: Number })
convertirEnDevis(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.service.convertirEnDevis(id, user.userId, user.companyId);
}
}
