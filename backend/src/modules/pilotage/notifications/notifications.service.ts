import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type AuthUser, paginate, PaginationQueryDto, toSkipTake } from '../../../common';
import { NiveauNotification, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

export interface NotificationInput {
  type: string;
  titre: string;
  message: string;
  niveau?: NiveauNotification;
  lien?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /** To specific users (inactive ones are skipped). Never throws. */
  async notifyUsers(companyId: number, userIds: (number | null | undefined)[], input: NotificationInput): Promise<void> {
    const ids = [...new Set(userIds.filter((id): id is number => typeof id === 'number'))];
    if (!ids.length) return;
    try {
      const users = await this.prisma.user.findMany({ where: { id: { in: ids }, companyId, actif: true }, select: { id: true } });
      for (const { id: userId } of users) {
        const notification = await this.prisma.notification.create({ data: { ...input, companyId, userId } });
        this.gateway.pushToUser(userId, 'notification', notification);
      }
    } catch (error) {
      this.logger.error(`Notification « ${input.type} » non envoyée`, error instanceof Error ? error.stack : String(error));
    }
  }

  /** To every active user with one of these roles. */
  async notifyRoles(companyId: number, roles: Role[], input: NotificationInput, extraUserIds: (number | null)[] = []) {
    const users = await this.prisma.user.findMany({ where: { companyId, role: { in: roles }, actif: true }, select: { id: true } });
    await this.notifyUsers(companyId, [...users.map((u) => u.id), ...extraUserIds], input);
  }

  // ── the current user's inbox ────────────────────────────────────────────

  async mine(user: AuthUser, query: PaginationQueryDto & { nonLues?: boolean }) {
    const where = { userId: user.id, ...(query.nonLues && { lueAt: null }) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(query) }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async unreadCount(user: AuthUser) {
    return { nonLues: await this.prisma.notification.count({ where: { userId: user.id, lueAt: null } }) };
  }

  async markRead(user: AuthUser, id: number) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, lueAt: null },
      data: { lueAt: new Date() },
    });
    if (!count && !(await this.prisma.notification.count({ where: { id, userId: user.id } }))) {
      throw new NotFoundException(`Notification #${id} introuvable`);
    }
    return this.unreadCount(user);
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, lueAt: null }, data: { lueAt: new Date() } });
    return { nonLues: 0 };
  }
}
