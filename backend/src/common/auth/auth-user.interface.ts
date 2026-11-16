import type { Request } from 'express';
import type { Role } from '../../generated/prisma/client';

/**
 * `password-change` = short-lived token handed out at first login (temporary password).
 * It is accepted ONLY on routes marked @AllowPasswordChangeToken().
 */
export type TokenScope = 'session' | 'password-change';

/** What we put inside the JWT. `sub` = user id (JWT standard claim). */
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
  companyId: number;
  /** Must equal User.tokenVersion, otherwise the token was revoked */
  ver: number;
  scope: TokenScope;
}

/** The authenticated user, available in controllers via @CurrentUser(). */
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  companyId: number;
  scope: TokenScope;
}

/** Express request enriched by our middleware and guards. */
export interface AppRequest extends Request {
  requestId?: string;
  user?: AuthUser;
}

/** The user fields needed to build a token. */
export interface TokenSubject {
  id: number;
  email: string;
  role: Role;
  companyId: number;
  tokenVersion: number;
}

export function buildJwtPayload(user: TokenSubject, scope: TokenScope = 'session'): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    ver: user.tokenVersion,
    scope,
  };
}
