import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function setup(metadata: Record<string, unknown>, user?: Partial<AuthUser>) {
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), ctx };
}

describe('RolesGuard', () => {
  it('lets public routes through', () => {
    const { guard, ctx } = setup({ [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuses a protected route that declares no roles (secure by default)', () => {
    const { guard, ctx } = setup({}, { role: Role.ADMIN });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a listed role', () => {
    const { guard, ctx } = setup({ [ROLES_KEY]: [Role.ADMIN, Role.TECHNICO] }, { role: Role.TECHNICO });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuses an unlisted role', () => {
    const { guard, ctx } = setup({ [ROLES_KEY]: [Role.ADMIN] }, { role: Role.SOUS_TRAITANT });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
