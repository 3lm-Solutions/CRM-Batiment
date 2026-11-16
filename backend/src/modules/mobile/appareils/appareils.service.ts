import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { EnregistrerAppareilDto } from './appareils.dto';

/**
 * Phones that receive push notifications (16/11, lot B1). One row per Expo token: when the
 * same phone is used by another account, the token moves to that account (never both).
 */
@Injectable()
export class AppareilsService {
  constructor(private readonly prisma: PrismaService) {}

  async enregistrer(user: AuthUser, dto: EnregistrerAppareilDto) {
    return this.prisma.appareilPush.upsert({
      where: { jeton: dto.jeton },
      create: { userId: user.id, jeton: dto.jeton, plateforme: dto.plateforme, nom: dto.nom },
      update: {
        userId: user.id,
        plateforme: dto.plateforme,
        nom: dto.nom,
        derniereActivite: new Date(),
      },
      select: { id: true, plateforme: true, nom: true, createdAt: true, derniereActivite: true },
    });
  }

  async mesAppareils(user: AuthUser) {
    return this.prisma.appareilPush.findMany({
      where: { userId: user.id },
      orderBy: { derniereActivite: 'desc' },
      select: { id: true, plateforme: true, nom: true, createdAt: true, derniereActivite: true },
    });
  }

  /** Idempotent: removing an unknown token (or another account's) does nothing. */
  async retirer(user: AuthUser, jeton: string): Promise<void> {
    await this.prisma.appareilPush.deleteMany({ where: { jeton, userId: user.id } });
  }
}
