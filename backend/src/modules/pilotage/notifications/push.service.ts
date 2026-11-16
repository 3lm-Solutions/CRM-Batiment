import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PushMessage {
  titre: string;
  message: string;
  /** Route to open in the app (same as the web notification link, e.g. /devis/42) */
  lien?: string;
  type: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const LOT = 100;

/**
 * Push notifications to the mobile app (16/11, lot B1), through Expo's push service.
 * Called by NotificationsService for every in-app notification: the web keeps its websocket,
 * the phone gets a push. Never throws (a push is a best effort, the notification is in the DB).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly actif: boolean;
  private readonly accessToken?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    // The public demo never pushes (like it never sends emails)
    this.actif =
      config.get('PUSH_ACTIF', { infer: true }) && !config.get('DEMO_MODE', { infer: true });
    this.accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true });
  }

  async envoyer(userIds: number[], msg: PushMessage): Promise<void> {
    if (!this.actif || !userIds.length) return;
    try {
      const appareils = await this.prisma.appareilPush.findMany({
        where: { userId: { in: userIds } },
        select: { jeton: true },
      });
      if (!appareils.length) return;
      const messages = appareils.map((a) => ({
        to: a.jeton,
        title: msg.titre,
        body: msg.message,
        sound: 'default',
        data: { lien: msg.lien ?? null, type: msg.type },
      }));
      for (let i = 0; i < messages.length; i += LOT) {
        await this.envoyerLot(messages.slice(i, i + LOT));
      }
    } catch (error) {
      this.logger.warn(`Push « ${msg.type} » non envoyé : ${String(error)}`);
    }
  }

  private async envoyerLot(lot: { to: string }[]): Promise<void> {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(lot),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.warn(`Expo push : HTTP ${res.status}`);
      return;
    }
    const { data } = (await res.json()) as { data?: ExpoTicket[] };
    // Tickets come back in the same order as the messages
    const perimes = (data ?? [])
      .map((t, i) =>
        t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? lot[i]?.to : null,
      )
      .filter((j): j is string => !!j);
    if (perimes.length) {
      await this.prisma.appareilPush.deleteMany({ where: { jeton: { in: perimes } } });
      this.logger.log(`${perimes.length} appareil(s) push désinscrit(s) supprimé(s)`);
    }
  }
}
