import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/client.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Toute route protégée doit déclarer explicitement sa matrice de rôles.
    if (!requiredRoles || requiredRoles.length === 0) {
      return false;
    }

    const { user } = ctx.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
