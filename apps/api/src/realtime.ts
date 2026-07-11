import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SOCKET_EVENTS, type ActivityEventDTO, type SaleProgressEvent } from '@apogee/shared';

/** Payloads the server can broadcast (typed socket.io emit map). */
interface ServerToClientEvents {
  [SOCKET_EVENTS.activityNew]: (event: ActivityEventDTO) => void;
  [SOCKET_EVENTS.saleProgress]: (progress: SaleProgressEvent) => void;
  [SOCKET_EVENTS.projectsChanged]: () => void;
}

let io: Server<Record<string, never>, ServerToClientEvents> | null = null;

/** Attach socket.io to the HTTP server. Namespace `/`, path `/socket.io`. */
export function initRealtime(httpServer: HttpServer): Server<Record<string, never>, ServerToClientEvents> {
  io = new Server<Record<string, never>, ServerToClientEvents>(httpServer, {
    path: '/socket.io',
    cors: { origin: true },
  });
  return io;
}

/** Broadcast `sale:progress` to all connected clients. No-op before init (e.g. seed script). */
export function emitSaleProgress(progress: SaleProgressEvent): void {
  io?.emit(SOCKET_EVENTS.saleProgress, progress);
}

/** Broadcast `activity:new` to all connected clients. */
export function emitActivity(event: ActivityEventDTO): void {
  io?.emit(SOCKET_EVENTS.activityNew, event);
}

/** Tell every client that sale statuses changed — they refetch project lists. */
export function emitProjectsChanged(): void {
  io?.emit(SOCKET_EVENTS.projectsChanged);
}
