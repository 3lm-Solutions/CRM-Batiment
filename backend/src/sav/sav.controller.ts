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
import { CreateSavTicketNoteDto } from './dto/create-sav-ticket-note.dto.js';
import { CreateSavTicketDto } from './dto/create-sav-ticket.dto.js';
import { QuerySavTicketDto } from './dto/query-sav-ticket.dto.js';
import { UpdateSavTicketDto } from './dto/update-sav-ticket.dto.js';
import { SavService } from './sav.service.js';

@ApiTags('SAV')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO, Role.CHEF_CHANTIER)
@Controller('sav')
export class SavController {
  constructor(private readonly savService: SavService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Créer un ticket SAV' })
  @ApiResponse({ status: 201, description: 'Ticket SAV cree.' })
  createTicket(
    @Body() dto: CreateSavTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.savService.createTicket(dto, user);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Liste filtrable des tickets SAV' })
  findAll(
    @Query() query: QuerySavTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.savService.findAll(query, user);
  }

  @Get('tickets/summary')
  @ApiOperation({ summary: 'Résumé des tickets SAV' })
  getSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.savService.getSummary(user);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Détail d’un ticket SAV' })
  @ApiParam({ name: 'id', type: Number })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.savService.findOne(id, user);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Modifier un ticket SAV' })
  @ApiParam({ name: 'id', type: Number })
  updateTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSavTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.savService.updateTicket(id, dto, user);
  }

  @Post('tickets/:id/notes')
  @ApiOperation({ summary: 'Ajouter une note interne au ticket SAV' })
  @ApiParam({ name: 'id', type: Number })
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSavTicketNoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.savService.addNote(id, dto, user);
  }
}
