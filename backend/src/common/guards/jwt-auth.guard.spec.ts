import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { type AppRequest, buildJwtPayload, type TokenScope } from '../auth/auth-user.interface';
import { ALLOW_PASSWORD_CHANGE_TOKEN_KEY } from '../decorators/allow-password-change-token.decorator';
import { SessionValidator } from '../auth/session-validator.service';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard';

const jwt = new JwtService({ secret: 'unit-test-secret-'.padEnd(40, 'x') });

const dbUser: {
  id: number;
  email: string;
  role: Role;
  companyId: number;
  actif: boolean;
  tokenVersion: number;
} = {
  id: 7,
  email: 'a@b.fr',
  role: Role.TECHNICO,
  companyId: 1,
  actif: true,
  tokenVersion: 3,
};

function makeGuard(options: { dbUser?: typeof dbUser | null; allowPasswordChange?: boolean } = {}) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === ALLOW_PASSWORD_CHANGE_TOKEN_KEY ? (options.allowPasswordChange ?? false) : false,
  } as unknown as Reflector;
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.dbUser === undefined ? dbUser : options.dbUser),
    },
  } as unknown as PrismaService;
  return new JwtAuthGuard(reflector, new SessionValidator(jwt, prisma));
}

function ctxWith(authorization?: string) {
  const request = { headers: { authorization } } as unknown as AppRequest;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

const tokenFor = (overrides: Partial<typeof dbUser> = {}, scope: TokenScope = 'session') =>
  `Bearer ${jwt.sign(buildJwtPayload({ ...dbUser, ...overrides }, scope))}`;

describe('JwtAuthGuard', () => {
  it('rejects a request without token', async () => {
    await expect(makeGuard().canActivate(ctxWith().ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a token forged with the old 'fallback-secret'", async () => {
    const forged = new JwtService({ secret: 'fallback-secret' }).sign(buildJwtPayload(dbUser));
    await expect(makeGuard().canActivate(ctxWith(`Bearer ${forged}`).ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the user, with role and company read from the DATABASE', async () => {
    const { ctx, request } = ctxWith(tokenFor({ role: Role.ADMIN })); // stale role in token
    await expect(makeGuard().canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 7,
      email: 'a@b.fr',
      role: Role.TECHNICO,
      companyId: 1,
      scope: 'session',
    });
  });

  it('rejects a deactivated account immediately', async () => {
    const guard = makeGuard({ dbUser: { ...dbUser, actif: false } });
    await expect(guard.canActivate(ctxWith(tokenFor()).ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a deleted account', async () => {
    const guard = makeGuard({ dbUser: null });
    await expect(guard.canActivate(ctxWith(tokenFor()).ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token issued before a password change (tokenVersion)', async () => {
    await expect(
      makeGuard().canActivate(ctxWith(tokenFor({ tokenVersion: 2 })).ctx),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a password-change token on a normal route', async () => {
    await expect(
      makeGuard().canActivate(ctxWith(tokenFor({}, 'password-change')).ctx),
    ).rejects.toThrow(/changer votre mot de passe/);
  });

  it('accepts a password-change token on an allowed route', async () => {
    const { ctx, request } = ctxWith(tokenFor({}, 'password-change'));
    await expect(makeGuard({ allowPasswordChange: true }).canActivate(ctx)).resolves.toBe(true);
    expect(request.user?.scope).toBe('password-change');
  });
});

describe('extractBearerToken', () => {
  it('parses only the Bearer scheme', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
