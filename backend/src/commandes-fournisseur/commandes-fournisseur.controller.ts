import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CommandesFournisseurService } from './commandes-fournisseur.service.js';
import { CreateReceptionDto } from './dto/create-reception.dto.js';
import { QueryCommandesFournisseurDto } from './dto/query-commandes-fournisseur.dto.js';
import { UpdateCommandeFournisseurDto } from './dto/update-commande-fournisseur.dto.js';

@ApiTags('Commandes fournisseur')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER, Role.TECHNICO)
@Controller('commandes-fournisseur')
export class CommandesFournisseurController {
  constructor(
    private readonly commandesFournisseurService: CommandesFournisseurService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste interne des commandes fournisseur',
    description:
      'Retourne les bons d achat fournisseur avec detail chantier, client et receptions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste paginee des commandes fournisseur.',
  })
  findAll(
    @Query() query: QueryCommandesFournisseurDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.commandesFournisseurService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail d une commande fournisseur',
    description:
      'Retourne une commande fournisseur avec ses lignes et son historique de reception chantier.',
  })
  @ApiResponse({ status: 200, description: 'Detail commande retourne.' })
  @ApiResponse({ status: 404, description: 'Commande introuvable.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.commandesFournisseurService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier manuellement une commande fournisseur',
    description:
      'Permet a l equipe interne d ajuster les lignes, notes et la date prevue avant l envoi au fournisseur.',
  })
  @ApiResponse({ status: 200, description: 'Commande mise a jour.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommandeFournisseurDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.commandesFournisseurService.update(id, dto, user);
  }

  @Post(':id/send')
  @ApiOperation({
    summary: 'Valider et envoyer une commande fournisseur',
    description:
      'Envoie la commande fournisseur par email apres validation interne.',
  })
  @ApiResponse({ status: 200, description: 'Commande envoyee.' })
  send(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.commandesFournisseurService.send(id, user);
  }

  @Post(':id/validate')
  @ApiOperation({
    summary: 'Valider une commande fournisseur avant envoi',
    description:
      'Permet a l equipe interne de valider manuellement une commande fournisseur avant son envoi au fournisseur.',
  })
  @ApiResponse({ status: 200, description: 'Commande validee.' })
  validateBeforeSend(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.commandesFournisseurService.validateBeforeSend(id, user);
  }

  @Roles(Role.ADMIN, Role.CHEF_CHANTIER)
  @Post(':id/receptions')
  @ApiOperation({
    summary: 'Creer une reception chantier',
    description:
      'Permet a l equipe interne d enregistrer une reception partielle ou complete sur une commande fournisseur.',
  })
  @ApiResponse({ status: 201, description: 'Reception enregistree.' })
  @ApiResponse({ status: 400, description: 'Quantite invalide.' })
  createReception(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReceptionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.commandesFournisseurService.createReception(id, dto, user);
  }
}
