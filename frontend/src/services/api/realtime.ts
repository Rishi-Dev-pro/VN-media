/* ============================================================
   Socket.IO realtime client (Phase 18, API mode).

   The backend requires a Bearer JWT on the socket handshake
   (`auth.token`), joins the user to `user:<id>`, and emits:

     notification:new   → a new notification for the recipient
     message:new        → a new message inside a conversation

   One singleton connection, created only when authenticated, torn
   down on logout. Reconnection is handled by socket.io-client; the
   same token is reused across reconnects (no duplicate listeners —
   `ensureSocket` returns the existing instance).
   ============================================================ */

import { io, type Socket } from 'socket.io-client';
import { isApiMode, SOCKET_URL } from './apiConfig';
import { clearSession, getToken } from './session';

let socket: Socket | null = null;

export function ensureSocket(): Socket | null {
  if (!isApiMode) return null;
  if (socket) return socket;
  const token = getToken();
  if (!token) return null;

  const next = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 8,
    reconnectionDelay: 1200,
  });

  next.on('connect_error', (err) => {
    const msg = err?.message ?? '';
    if (msg === 'Authentication required' || msg === 'Invalid or expired token') {
      // the session is no longer valid server-side — drop it centrally
      clearSession();
      disconnectSocket();
    }
  });

  socket = next;
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
