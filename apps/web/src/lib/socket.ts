import { io, type Socket } from 'socket.io-client';

/**
 * Singleton socket. Same-origin: Vite proxies /socket.io in dev,
 * Nginx proxies it in production.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return socket;
}
