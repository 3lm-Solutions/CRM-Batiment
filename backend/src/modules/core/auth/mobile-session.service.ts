import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { PrismaService } from '../../../prisma/prisma.service';

const SESSION_EXPIREE = 'Session expirée. Reconnectez-vous.';

export const hashJeton = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

/**
 * Long mobile session (16/11, lot B1). The web keeps its single access token (JWT_EXPIRES_IN);
 * the mobile app, which asks for it with the header « X-Client: mobile », also gets a refresh
 * token to obtain a new access token without typing the password again.
 *
 *  - only the SHA-256 of the refresh token is stored;
 *  - ROTATION: each use revokes it and returns a new one;
 *  - reuse of a revoked token (stolen copy) → every mobile session of the user is revoked;
 *  - bound to `tokenVersion`: a password change / reset or a deactivation ends it, like the JWT.
 */
@Injectable()
export class MobileSessionService {
  private readonly logger = new Logger(MobileSessionService.name);
  private readonly dureeMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.dureeMs = config.get('MOBILE_REFRESH_JOURS', { infer: true }) * 86_400_000;
  }

  async emettre(
    user: { id: number; tokenVersion: number },
    appareil?: string | null,
  ): Promise<{ refreshToken: string; refreshExpiresAt: Date }> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.dureeMs);
    // Housekeeping: expired ones, and revoked ones kept a week (to detect a reuse)
    await this.prisma.sessionMobile.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
        ],
      },
    });
    await this.prisma.sessionMobile.create({
      data: {
        userId: user.id,
        tokenHash: hashJeton(refreshToken),
        tokenVersion: user.tokenVersion,
        appareil: appareil?.slice(0, 100) || null,
        expiresAt,
      },
    });
    return { refreshToken, refreshExpiresAt: expiresAt };
  }

  /** Checks and consumes a refresh token; returns the user to open a new session for. */
  async consommer(refreshToken: string) {
    const session = await this.prisma.sessionMobile.findUnique({
      where: { tokenHash: hashJeton(refreshToken) },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException(SESSION_EXPIREE);

    if (session.revokedAt) {
      await this.revoquerTout(session.userId);
      this.logger.warn(
        `Jeton mobile réutilisé : sessions de l’utilisateur #${session.userId} révoquées`,
      );
      throw new UnauthorizedException(SESSION_EXPIREE);
    }
    const { user } = session;
    if (
      session.expiresAt < new Date() ||
      !user.actif ||
      user.mustChangePassword ||
      user.tokenVersion !== session.tokenVersion
    ) {
      await this.prisma.sessionMobile.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(SESSION_EXPIREE);
    }

    // Conditional: two simultaneous refreshes with the same token → only one wins
    const { count } = await this.prisma.sessionMobile.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!count) {
      await this.revoquerTout(session.userId);
      throw new UnauthorizedException(SESSION_EXPIREE);
    }
    return { user, appareil: session.appareil };
  }

  /** Logout of this phone: the token stops working (unknown token: nothing to do). */
  async revoquer(refreshToken: string): Promise<number | null> {
    const session = await this.prisma.sessionMobile.findUnique({
      where: { tokenHash: hashJeton(refreshToken) },
      select: { id: true, userId: true },
    });
    if (!session) return null;
    await this.prisma.sessionMobile.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return session.userId;
  }

  async revoquerTout(userId: number): Promise<void> {
    await this.prisma.sessionMobile.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
