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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreateRagDocumentDto } from './dto/create-rag-document.dto.js';
import { QueryRagDocumentsDto } from './dto/query-rag-documents.dto.js';
import { UpdateRagDocumentDto } from './dto/update-rag-document.dto.js';
import { RagService } from './rag.service.js';

@ApiTags('Base IA / RAG')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rag/documents')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Creer un document de base IA (Admin)' })
  @ApiResponse({ status: 201, description: 'Document cree' })
  create(
    @Body() dto: CreateRagDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ragService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lister les documents de base IA (Admin)' })
  findAll(
    @Query() query: QueryRagDocumentsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ragService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Detail document de base IA (Admin)' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ragService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier un document de base IA (Admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRagDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ragService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un document de base IA (Admin)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ragService.remove(id, user);
  }
}
