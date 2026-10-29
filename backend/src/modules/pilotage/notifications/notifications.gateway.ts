import { Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SessionValidator } from '../../../common';

/**
 * Real-time channel: the browser connects with `io('/notifications', { auth: { token } })`.
 * v2: same checks as HTTP (SessionValidator) — the old gateway only verified the token
 * signature, so a deactivated user kept receiving the company's notifications.
 */
@WebSocketGateway({ namespace: '/notifications', cors: { origin: true, credentials: true } })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly sessions: SessionValidator) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as { token?: unknown };
    const token = typeof auth.token === 'string' ? auth.token : undefined;
    try {
      if (!token) throw new Error('token manquant');
      const user = await this.sessions.validate(token);
      await client.join(`user:${user.id}`);
    } catch (error) {
      this.logger.debug(
        `Connexion websocket refusée : ${error instanceof Error ? error.message : String(error)}`,
      );
      client.disconnect(true);
    }
  }

  pushToUser(userId: number, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
