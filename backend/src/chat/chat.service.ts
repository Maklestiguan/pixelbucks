import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async saveMessage(userId: string, room: string, content: string) {
    const message = await this.prisma.chatMessage.create({
      data: { userId, room, content },
      include: { user: { select: { id: true, username: true } } },
    });
    return this.formatMessage(message);
  }

  async getHistory(room: string, limit = 100) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { room },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, username: true } } },
    });
    return messages.reverse().map(this.formatMessage);
  }

  async cleanupOldMessages(days = 14) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(
      `Cleaned up ${result.count} chat messages older than ${days} days`,
    );
    return result.count;
  }

  private formatMessage(msg: {
    id: string;
    content: string;
    room: string;
    createdAt: Date;
    user: { id: string; username: string };
  }) {
    return {
      id: msg.id,
      content: msg.content,
      room: msg.room,
      createdAt: msg.createdAt.toISOString(),
      user: { id: msg.user.id, username: msg.user.username },
    };
  }
}
