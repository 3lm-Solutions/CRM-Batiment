import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRequest } from '../auth/auth-user.interface';
import { SessionValidator } from '../auth/session-validator.service';
import { ALLOW_PASSWORD_CHANGE_TOKEN_KEY } from '../decorators/allow-password-change-token.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Global guard #1 — authentication. The rules live in SessionValidator (shared with websockets). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionValidator,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = ctx.switchToHttp().getRequest<AppRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Authentification requise');

    request.user = await this.sessions.validate(token, {
      allowPasswordChange: this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_TOKEN_KEY, targets) ?? false,
    });
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
