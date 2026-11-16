import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { QueryInternalNotificationsDto } from './dto/query-internal-notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ASSISTANTE, Role.CHEF_CHANTIER, Role.TECHNICO, Role.SOUS_TRAITANT)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('internal')
  @ApiOperation({
    summary: 'Notifications internes P0',
    description:
      'Retourne les alertes P0, signatures de devis, modifications de prix et notifications internes recentes.',
  })
  @ApiResponse({ status: 200, description: 'Notifications retournees.' })
  listInternal(
    @Query() query: QueryInternalNotificationsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.notificationsService.listInternalNotifications(
      user,
      query.limit ?? 10,
    );
  }
}
