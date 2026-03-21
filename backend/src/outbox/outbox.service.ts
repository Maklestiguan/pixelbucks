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

    const results = await Promise.allSettled(
      events.map((event) =>
        this.channel
          .publish(this.getExchange(event.type), event.type, event.payload)
          .then(() => event.id),
      ),
    );

    const successIds: string[] = [];
    for (const [i, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        successIds.push(result.value);
        this.logger.debug(
          `Published outbox event: ${events[i].type} (${events[i].id})`,
        );
      } else {
        this.logger.error(
          `Failed to publish outbox event ${events[i].id}: ${result.reason}`,
        );
      }
    }

    if (successIds.length > 0) {
      await this.prisma.outboxEvent.updateMany({
        where: { id: { in: successIds } },
        data: { processed: true, processedAt: new Date() },
      });
    }
  }

  private getExchange(type: string): string {
    if (type.startsWith('event.')) return EXCHANGES.EVENTS;
    if (type.startsWith('user.')) return EXCHANGES.USERS;
    return EXCHANGES.EVENTS;
  }
}
