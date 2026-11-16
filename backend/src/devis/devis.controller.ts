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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { DevisService } from './devis.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateDevisDto } from './dto/update-devis.dto.js';
import { QueryDevisDto } from './dto/query-devis.dto.js';
import { UpdateDevisStatutDto } from './dto/update-devis-statut.dto.js';
import { CreateLigneDevisDto } from './dto/create-ligne-devis.dto.js';
import { UpdateLigneDevisDto } from './dto/update-ligne-devis.dto.js';
import { SendClientSignatureDto } from './dto/send-client-signature.dto.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('Devis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TECHNICO', 'ASSISTANTE') // <-- AJOUTE
@Controller('devis')
export class DevisController {
  constructor(private readonly service: DevisService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Creer un devis en brouillon' })
  create(@Body() dto: CreateDevisDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.create(dto, user.userId, user.companyId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Lister les devis avec pagination et filtres' })
  findAll(
    @Query() query: QueryDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({ summary: 'Consulter le detail d un devis' })
  @ApiParam({ name: 'id', type: Number })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Modifier les informations generales du devis' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Patch(':id/statut')
  @Roles(Role.ADMIN, Role.TECHNICO)
  @ApiOperation({ summary: 'Changer manuellement le statut du devis' })
  @ApiParam({ name: 'id', type: Number })
  updateStatut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDevisStatutDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateStatut(id, dto, user.companyId, user.userId);
  }

  @Post(':id/send-client')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Envoyer le devis au client par email pour validation',
  })
  @ApiParam({ name: 'id', type: Number })
  sendToClient(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.sendToClient(id, user.companyId);
  }

  @Post(':id/bon-commande/validate-send')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER)
  @ApiOperation({
    summary:
      'Valider le bon de commande et envoyer les commandes fournisseur',
  })
  @ApiParam({ name: 'id', type: Number })
  validateBonCommandeAndSend(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.validateBonCommandeAndSend(id, user.companyId);
  }

  @Get(':id/signature')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Consulter l etat de signature client/conseiller du devis',
  })
  @ApiParam({ name: 'id', type: Number })
  getSignatureOverview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.getSignatureOverview(id, user.companyId);
  }

  @Post(':id/signature/send-client')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Envoyer un lien SMS pour la signature client du devis',
  })
  @ApiParam({ name: 'id', type: Number })
  sendClientSignatureRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendClientSignatureDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.sendClientSignatureRequest(id, dto, user.companyId);
  }

  @Post(':id/signature/appose-conseiller')
  @Roles(Role.ADMIN, Role.TECHNICO)
  @ApiOperation({
    summary: 'Apposer la signature configuree du conseiller sur le devis',
  })
  @ApiParam({ name: 'id', type: Number })
  apposeConseillerSignature(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.apposeConseillerSignature(
      id,
      user.companyId,
      user.userId,
    );
  }

  @Post(':id/lignes')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Ajouter une ligne au devis' })
  @ApiParam({ name: 'id', type: Number })
  addLigne(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLigneDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.addLigne(id, dto, user.companyId);
  }

  @Post(':id/lignes/checklist')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({
    summary: 'Ajouter des lignes depuis la checklist technicien',
  })
  @ApiParam({ name: 'id', type: Number })
  addLignesFromChecklist(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      items: {
        prestationId: number;
        quantite: number;
        selectedOptions?: { optionId: number; choixOptionIds: number[] }[];
      }[];
    },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.addLignesFromChecklist(id, body.items, user.companyId);
  }

  @Delete(':id/lignes/:ligneId')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Supprimer une ligne du devis' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'ligneId', type: Number })
  removeLigne(
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.removeLigne(id, ligneId, user.companyId);
  }

  @Patch(':id/lignes/:ligneId')
  @Roles(Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE)
  @ApiOperation({ summary: 'Modifier une ligne du devis' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'ligneId', type: Number })
  updateLigne(
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() dto: UpdateLigneDevisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.updateLigne(id, ligneId, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un devis (force=true pour suppression complete en cascade)' })
  @ApiParam({ name: 'id', type: Number })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') force: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.remove(id, user.companyId, force === 'true');
  }
}
