import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DefaultEventsMap, Server, Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
  username: string;
}

interface SocketData {
  userId: string;
  username: string;
}

function isJwtPayload(value: unknown): value is JwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as JwtPayload).sub === 'string' &&
    typeof (value as JwtPayload).username === 'string'
  );
}

@WebSocketGateway({
  namespace: '/events',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(
    client: Socket<
      DefaultEventsMap,
      DefaultEventsMap,
      DefaultEventsMap,
      SocketData
    >,
  ) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace(
          'Bearer ',
          '',
        ) as string);

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload: unknown = this.jwtService.verify(token);
      if (!isJwtPayload(payload)) {
        client.emit('error', { message: 'Invalid token payload' });
        client.disconnect();
        return;
      }
      client.data.userId = payload.sub;
      client.data.username = payload.username;

      // Join a user-specific room for targeted events (e.g. balance updates)
      await client.join(`user:${payload.sub}`);

      this.logger.log(
        `Events client connected: ${payload.username} (${client.id})`,
      );
    } catch {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(
    client: Socket<
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
      SocketData
    >,
  ) {
    if (client.data.username) {
      this.logger.log(
        `Events client disconnected: ${client.data.username} (${client.id})`,
      );
    }
  }

  broadcastOddsUpdate(eventId: string, oddsA: number, oddsB: number) {
    this.server.emit('odds_updated', { eventId, oddsA, oddsB });
  }

  broadcastStatusChange(
    eventId: string,
    status: string,
    extras?: Record<string, unknown>,
  ) {
    this.server.emit('status_changed', { eventId, status, ...extras });
  }

  /** Send balance update to a specific user's connected clients */
  sendBalanceUpdate(userId: string, balance: number) {
    this.server.to(`user:${userId}`).emit('balance_updated', { balance });
  }
}
