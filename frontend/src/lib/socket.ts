import { io, type Socket } from 'socket.io-client';

/** Real-time notifications (namespace /notifications, token in the handshake). */
export function connectNotifications(token: string): Socket {
  const base = import.meta.env.VITE_WS_URL ?? '';
  return io(`${base}/notifications`, { auth: { token }, transports: ['websocket'], reconnectionDelay: 2000 });
}
