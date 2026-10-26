import { io, type Socket } from 'socket.io-client';

/**
 * Real-time notifications (namespace /notifications, token in the handshake).
 *
 * One shared connection, closed a moment after its last subscriber leaves. In development
 * React StrictMode mounts every component twice (mount → unmount → mount): closing the
 * socket immediately printed « WebSocket is closed before the connection is established »
 * in the console (report of 20/10). The delayed close lets the second mount reuse it.
 */
interface Shared {
  token: string;
  socket: Socket;
  subscribers: number;
  closeTimer?: ReturnType<typeof setTimeout>;
}

let shared: Shared | null = null;
const CLOSE_DELAY_MS = 1000;

function open(token: string): Shared {
  if (shared && shared.token !== token) {
    // Another session (logout / login): never keep the previous user's connection
    clearTimeout(shared.closeTimer);
    shared.socket.close();
    shared = null;
  }
  if (!shared) {
    const base = import.meta.env.VITE_WS_URL ?? '';
    const socket = io(`${base}/notifications`, { auth: { token }, transports: ['websocket'], reconnectionDelay: 2000 });
    shared = { token, socket, subscribers: 0 };
  }
  return shared;
}

/** Listens to `notification` events; returns the unsubscribe function (for a useEffect cleanup). */
export function subscribeNotifications<T>(token: string, onNotification: (payload: T) => void): () => void {
  const conn = open(token);
  clearTimeout(conn.closeTimer);
  conn.subscribers += 1;
  conn.socket.on('notification', onNotification);

  return () => {
    conn.socket.off('notification', onNotification);
    conn.subscribers -= 1;
    if (conn.subscribers > 0) return;
    conn.closeTimer = setTimeout(() => {
      if (shared === conn && conn.subscribers === 0) {
        conn.socket.close();
        shared = null;
      }
    }, CLOSE_DELAY_MS);
  };
}
