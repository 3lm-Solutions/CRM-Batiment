import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

export interface RealtimeEventPayload {
  reason: string;
  entity?: string;
  entityId?: number;
  actorId?: number | null;
  occurredAt?: string;
  [key: string]: unknown;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const authorization = client.handshake.headers.authorization;
    const headerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const authToken =
      typeof client.handshake.auth?.['token'] === 'string'
        ? client.handshake.auth['token']
        : undefined;
    const token = authToken ?? headerToken;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data['user'] = payload;
      await client.join(`company:${payload.companyId}`);
      await client.join(`user:${payload.sub}`);
      await client.join(`role:${payload.role}`);

      client.emit('realtime:ready', {
        connected: true,
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Connexion WebSocket refusée pour ${client.id}: ${
          error instanceof Error ? error.message : 'token invalide'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client WebSocket déconnecté: ${client.id}`);
  }

  emitToCompany(
    companyId: number,
    event: string,
    payload: RealtimeEventPayload,
  ) {
    this.server?.to(`company:${companyId}`).emit(event, {
      ...payload,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    });
  }

  emitToUser(
    userId: number,
    event: string,
    payload: RealtimeEventPayload,
  ) {
    this.server?.to(`user:${userId}`).emit(event, {
      ...payload,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    });
  }
}
