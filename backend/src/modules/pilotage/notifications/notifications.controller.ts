import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  ALL_ROLES,
  type AuthUser,
  CurrentUser,
  PaginationQueryDto,
  Roles,
  ToBoolean,
} from '../../../common';
import { NotificationsService } from './notifications.service';

class QueryNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  nonLues?: boolean;
}

/** Every user reads only HIS notifications. Real-time: socket.io namespace /notifications. */
@ApiTags('Notifications')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryNotificationsDto) {
    return this.notifications.mine(user, query);
  }

  @Get('compteur')
  count(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Post('tout-lire')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/lue')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(user, id);
  }
}
