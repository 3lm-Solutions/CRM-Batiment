import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser, JwtPayload } from './auth-user.interface';

/**
 * Turns a raw token into an authenticated user — used by the HTTP guard AND the websocket
 * gateway, so both apply exactly the same rules:
 *  - valid signature and expiry
 *  - restricted `password-change` tokens only where explicitly allowed
 *  - account still exists and is active, tokenVersion unchanged (not revoked)
 *  - role and company read from the database
 */
@Injectable()
export class SessionValidator {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validate(
    token: string,
    options: { allowPasswordChange?: boolean } = {},
  ): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    if (typeof payload.sub !== 'number' || typeof payload.ver !== 'number') {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    const scope = payload.scope ?? 'session';
    if (scope === 'password-change' && !options.allowPasswordChange) {
      throw new UnauthorizedException('Vous devez changer votre mot de passe avant de continuer');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        actif: true,
        tokenVersion: true,
      },
    });
    if (!user || !user.actif) throw new UnauthorizedException('Compte inexistant ou désactivé');
    if (user.tokenVersion !== payload.ver)
      throw new UnauthorizedException('Session expirée, veuillez vous reconnecter');

    return { id: user.id, email: user.email, role: user.role, companyId: user.companyId, scope };
  }
}
