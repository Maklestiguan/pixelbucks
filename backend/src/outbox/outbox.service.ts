import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { PrismaService } from '../prisma';
import {
  RABBITMQ_CHANNEL,
  EXCHANGES,
  ROUTING_KEYS,
} from '../rabbitmq/rabbitmq.module';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(RABBITMQ_CHANNEL) private channel: ChannelWrapper,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutbox() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { processed: false },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (events.length === 0) return;

    for (const event of events) {
      try {
        const exchange = this.getExchange(event.type);
        const routingKey = event.type;

        await this.channel.publish(exchange, routingKey, event.payload);

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { processed: true, processedAt: new Date() },
        });

        this.logger.debug(
          `Published outbox event: ${event.type} (${event.id})`,
        );
      } catch (err) {
        this.logger.error(`Failed to publish outbox event ${event.id}: ${err}`);
      }
    }
  }

  private getExchange(type: string): string {
    if (type.startsWith('event.')) return EXCHANGES.EVENTS;
    if (type.startsWith('user.')) return EXCHANGES.USERS;
    return EXCHANGES.EVENTS;
  }
}
