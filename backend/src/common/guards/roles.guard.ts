import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client';
import type { AppRequest } from '../auth/auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Global guard #2 — authorization. Runs after JwtAuthGuard.
 * Secure by default: a protected route with no @Roles() is refused.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!allowed || allowed.length === 0) {
      throw new ForbiddenException('Accès non configuré pour cette route');
    }

    const user = ctx.switchToHttp().getRequest<AppRequest>().user;
    if (!user || !allowed.includes(user.role)) {
      throw new ForbiddenException("Vous n'avez pas les droits pour cette action");
    }
    return true;
  }
}
