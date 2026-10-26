import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../../../common';
import { Role } from '../../../../generated/prisma/client';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './checklist.dto';
import { ChecklistService } from './checklist.service';

/** Same roles as task edition (the chef on his job sites). */
@ApiTags('Chantiers — tâches')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER)
@Controller('chantiers/:chantierId/taches/:tacheId/checklist')
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un point à cocher (l’avancement de la tâche suit la checklist)' })
  add(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.checklist.add(user, chantierId, tacheId, dto);
  }

  @Patch(':itemId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.checklist.update(user, chantierId, tacheId, itemId, dto);
  }

  @Delete(':itemId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('chantierId', ParseIntPipe) chantierId: number,
    @Param('tacheId', ParseIntPipe) tacheId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.checklist.remove(user, chantierId, tacheId, itemId);
  }
}
