import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

const VALID_ROOMS = ['en', 'ru'];
const MAX_CONTENT_LENGTH = 120;
const RATE_LIMIT_MS = 2000; // 1 message per 2 seconds

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private lastMessageTime = new Map<string, number>();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
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

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.username = payload.username;

      this.logger.log(`Client connected: ${payload.username} (${client.id})`);
    } catch {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.lastMessageTime.delete(client.id);
    if (client.data.username) {
      this.logger.log(
        `Client disconnected: ${client.data.username} (${client.id})`,
      );
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const room = data?.room;
    if (!room || !VALID_ROOMS.includes(room)) {
      return { error: 'Invalid room. Use "en" or "ru".' };
    }

    // Leave all other chat rooms first
    for (const r of VALID_ROOMS) {
      client.leave(r);
    }

    client.join(room);
    client.data.room = room;

    const history = await this.chatService.getHistory(room);
    return { room, history };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const room = data?.room;
    if (room && VALID_ROOMS.includes(room)) {
      client.leave(room);
    }
    return { ok: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string },
  ) {
    if (!client.data.userId) {
      return { error: 'Not authenticated' };
    }

    const room = client.data.room;
    if (!room || !VALID_ROOMS.includes(room)) {
      return { error: 'Join a room first' };
    }

    // Rate limiting
    const now = Date.now();
    const lastTime = this.lastMessageTime.get(client.id) || 0;
    if (now - lastTime < RATE_LIMIT_MS) {
      return { error: 'Too fast. Wait 2 seconds between messages.' };
    }

    const content = data?.content?.trim();
    if (!content) {
      return { error: 'Message cannot be empty' };
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        error: `Message too long. Max ${MAX_CONTENT_LENGTH} characters.`,
      };
    }

    this.lastMessageTime.set(client.id, now);

    const message = await this.chatService.saveMessage(
      client.data.userId,
      room,
      content,
    );

    this.server.to(room).emit('new_message', message);
    return { ok: true };
  }
}
