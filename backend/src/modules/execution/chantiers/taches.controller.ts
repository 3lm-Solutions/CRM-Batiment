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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles, STAFF } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { CreateTacheCommentaireDto } from './commentaires/tache-commentaires.dto';
import { TacheCommentairesService } from './commentaires/tache-commentaires.service';
import { CreateTacheDto, UpdateTacheDto } from './dto/chantiers.dto';
import { TachesService } from './taches.service';

@ApiTags('Chantiers — tâches')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
@Controller('chantiers/:chantierId/taches')
export class TachesController {
  constructor(
    private readonly taches: TachesService,
    private readonly commentaires: TacheCommentairesService,
  ) {}

  @Roles(...STAFF)
  @Get()
  list(@CurrentUser() user: AuthUser, @Param('chantierId', ParseIntPipe) chantierId: number) {
    return this.taches.list(user, chantierId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Body() dto: CreateTacheDto,
  ) {
    return this.taches.create(user, chantierId, dto);
  }

  @Patch(':tacheId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Body() dto: UpdateTacheDto,
  ) {
    return this.taches.update(user, chantierId, tacheId, dto);
  }

  @Delete(':tacheId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
  ) {
    return this.taches.remove(user, chantierId, tacheId);
  }

  // ── comment thread (16/11, mobile lot B1) ───────────────────────────────

  @Roles(...STAFF)
  @Get(':tacheId/commentaires')
  @ApiOperation({ summary: 'Fil de commentaires d’une tâche (plus ancien d’abord)' })
  commentairesList(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
  ) {
    return this.commentaires.list(user, chantierId, tacheId);
  }

  @Post(':tacheId/commentaires')
  @ApiOperation({ summary: 'Ajouter un commentaire (les intervenants et le chef sont notifiés)' })
  commenter(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Body() dto: CreateTacheCommentaireDto,
  ) {
    return this.commentaires.ajouter(user, chantierId, tacheId, dto.texte);
  }
}
