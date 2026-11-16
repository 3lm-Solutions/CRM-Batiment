import {
  Body,
  Controller,
  Delete,
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
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreateFactureFromDevisDto } from './dto/create-facture-from-devis.dto.js';
import { CreateFactureLigneDto } from './dto/create-facture-ligne.dto.js';
import { QueryFacturesDevisDto } from './dto/query-factures-devis.dto.js';
import { QueryFacturesDto } from './dto/query-factures.dto.js';
import { SendFactureDto } from './dto/send-facture.dto.js';
import { UpdateFactureLigneDto } from './dto/update-facture-ligne.dto.js';
import { UpdateFactureStatutDto } from './dto/update-facture-statut.dto.js';
import { UpdateFactureDto } from './dto/update-facture.dto.js';
import { FacturesService } from './factures.service.js';

@ApiTags('Factures')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ASSISTANTE', 'TECHNICO')
@Controller('factures')
export class FacturesController {
  constructor(private readonly facturesService: FacturesService) {}

  @Get('devis-sources')
  @ApiOperation({ summary: 'Lister les devis transformables en facture' })
  listDevisSources(
    @Query() query: QueryFacturesDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.listDevisSources(query, user.companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les factures' })
  findAll(
    @Query() query: QueryFacturesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.findAll(query, user.companyId);
  }

  @Post('from-devis/:devisId')
  @Roles('ADMIN') // ajoutee 
  @ApiOperation({ summary: 'Creer une facture pre-remplie depuis un devis' })
  @ApiParam({ name: 'devisId', type: Number })
  createFromDevis(
    @Param('devisId', ParseIntPipe) devisId: number,
    @Body() dto: CreateFactureFromDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.createFromDevis(devisId, dto, user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail d une facture' })
  @ApiParam({ name: 'id', type: Number })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mettre a jour une facture (champs + lignes)' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFactureDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.update(id, dto, user.companyId);
  }

  @Patch(':id/statut')
  @Roles('ADMIN', 'ASSISTANTE')
  @ApiOperation({ summary: 'Changer le statut d une facture' })
  @ApiParam({ name: 'id', type: Number })
  updateStatut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFactureStatutDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.updateStatut(id, dto, user.companyId);
  }

  @Post(':id/lignes')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ajouter une ligne facture' })
  @ApiParam({ name: 'id', type: Number })
  addLigne(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFactureLigneDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.addLigne(id, dto, user.companyId);
  }

  @Patch(':id/lignes/:ligneId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Modifier une ligne facture' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'ligneId', type: Number })
  updateLigne(
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() dto: UpdateFactureLigneDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.updateLigne(id, ligneId, dto, user.companyId);
  }

  @Delete(':id/lignes/:ligneId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Supprimer une ligne facture' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'ligneId', type: Number })
  removeLigne(
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.removeLigne(id, ligneId, user.companyId);
  }

  @Post(':id/send-client')
  @Roles('ADMIN', 'ASSISTANTE')
  @ApiOperation({ summary: 'Envoyer une facture au client par email' })
  @ApiParam({ name: 'id', type: Number })
  sendToClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendFactureDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.facturesService.sendToClient(id, dto, user.companyId);
  }
}
