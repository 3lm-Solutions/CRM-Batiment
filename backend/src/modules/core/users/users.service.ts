import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AuthUser, BusinessException, paginate, parseSort, STAFF, toSkipTake } from '../../../common';
import type { Env } from '../../../config/env.validation';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { MailService } from '../mail/mail.service';
import { accountCreatedMail, temporaryPasswordResetMail } from '../mail/templates/auth.templates';
import { CreateUserDto, QueryUsersDto, UpdateUserDto, UserOptionsQueryDto } from './dto/users.dto';

export const USER_SELECT = {
  id: true,
  email: true,
  nom: true,
  prenom: true,
  role: true,
  telephone: true,
  actif: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const SORTABLE = ['nom', 'email', 'role', 'createdAt', 'lastLoginAt'] as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async findAll(admin: AuthUser, query: QueryUsersDto) {
    const where: Prisma.UserWhereInput = {
      companyId: admin.companyId,
      role: query.role,
      actif: query.actif,
      ...(query.search && {
        OR: [
          { nom: { contains: query.search, mode: 'insensitive' } },
          { prenom: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: parseSort(query.sort, SORTABLE, { nom: 'asc' }),
        ...toSkipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  /**
   * Lightweight list for dropdowns: name + role of active accounts. Without `roles`: internal staff.
   * Asked roles are honoured — before, only staff roles were kept, so SOUS_TRAITANT accounts never
   * appeared when assigning a task or opening a job site, and FOURNISSEUR accounts could not be
   * linked to a supplier. Supplier accounts are listed for the admin only (only he links them).
   */
  options(user: AuthUser, query: UserOptionsQueryDto) {
    const allowed = (Object.values(Role) as Role[]).filter((r) => r !== Role.FOURNISSEUR || user.role === Role.ADMIN);
    const roles = query.roles?.length ? query.roles.filter((r) => allowed.includes(r)) : STAFF;
    return this.prisma.user.findMany({
      where: { companyId: user.companyId, actif: true, role: { in: roles } },
      select: { id: true, nom: true, prenom: true, role: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async findOne(admin: AuthUser, id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`Utilisateur #${id} introuvable`);
    return user;
  }

  async create(admin: AuthUser, dto: CreateUserDto) {
    const temporaryPassword = this.passwords.generateTemporaryPassword();

    // Email already used -> P2002 -> 409 DUPLICATE (global filter)
    const user = await this.prisma.user.create({
      data: {
        ...dto,
        companyId: admin.companyId,
        password: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
      },
      select: USER_SELECT,
    });

    const emailSent = await this.mail.send(
      user.email,
      accountCreatedMail({ ...user, temporaryPassword, appUrl: this.appUrl() }),
    );

    this.logger.log(`Utilisateur #${user.id} (${user.role}) créé par #${admin.id}`);
    return { user, emailSent, ...this.exposeInDev(temporaryPassword) };
  }

  async update(admin: AuthUser, id: number, dto: UpdateUserDto) {
    const target = await this.findOne(admin, id);

    if (dto.role && dto.role !== target.role) {
      if (target.id === admin.id) {
        throw new BusinessException('PROPRE_ROLE', 'Vous ne pouvez pas modifier votre propre rôle.');
      }
      if (target.role === Role.ADMIN) await this.ensureAnotherActiveAdmin(admin.companyId, target.id);
    }

    return this.prisma.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  async deactivate(admin: AuthUser, id: number) {
    const target = await this.findOne(admin, id);
    if (target.id === admin.id) {
      throw new BusinessException('PROPRE_COMPTE', 'Vous ne pouvez pas désactiver votre propre compte.');
    }
    if (target.role === Role.ADMIN) await this.ensureAnotherActiveAdmin(admin.companyId, target.id);

    // Takes effect on the user's very next request (JwtAuthGuard checks `actif`)
    return this.prisma.user.update({ where: { id }, data: { actif: false }, select: USER_SELECT });
  }

  async activate(admin: AuthUser, id: number) {
    await this.findOne(admin, id);
    return this.prisma.user.update({ where: { id }, data: { actif: true }, select: USER_SELECT });
  }

  async resetPassword(admin: AuthUser, id: number) {
    const target = await this.findOne(admin, id);
    const temporaryPassword = this.passwords.generateTemporaryPassword();

    await this.prisma.user.update({
      where: { id },
      data: {
        password: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
        tokenVersion: { increment: 1 }, // closes the user's open sessions
        resetCodeHash: null,
        resetCodeExpiresAt: null,
      },
    });

    const emailSent = await this.mail.send(
      target.email,
      temporaryPasswordResetMail({ prenom: target.prenom, temporaryPassword, appUrl: this.appUrl() }),
    );

    this.logger.log(`Mot de passe de #${id} réinitialisé par #${admin.id}`);
    return { emailSent, ...this.exposeInDev(temporaryPassword) };
  }

  /**
   * Hard delete. If the user is referenced (quotes, tickets…) PostgreSQL refuses ->
   * 409 RESOURCE_IN_USE: deactivation is the normal path.
   */
  async remove(admin: AuthUser, id: number): Promise<void> {
    const target = await this.findOne(admin, id);
    if (target.id === admin.id) {
      throw new BusinessException('PROPRE_COMPTE', 'Vous ne pouvez pas supprimer votre propre compte.');
    }
    if (target.role === Role.ADMIN) {
      throw new BusinessException('SUPPRESSION_ADMIN', 'Un compte administrateur ne peut pas être supprimé.');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async ensureAnotherActiveAdmin(companyId: number, excludedId: number): Promise<void> {
    const others = await this.prisma.user.count({
      where: { companyId, role: Role.ADMIN, actif: true, id: { not: excludedId } },
    });
    if (others === 0) {
      throw new BusinessException(
        'DERNIER_ADMIN',
        "Impossible : c'est le dernier administrateur actif de l'entreprise.",
      );
    }
  }

  private appUrl(): string {
    return this.config.get('APP_URL', { infer: true });
  }

  /** The temporary password is returned in the API response only outside production. */
  private exposeInDev(temporaryPassword: string): { temporaryPassword?: string } {
    return this.config.get('NODE_ENV', { infer: true }) === 'production' ? {} : { temporaryPassword };
  }
}
