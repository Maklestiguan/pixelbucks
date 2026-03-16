import {
  Global,
  Module,
  Inject,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';

export const RABBITMQ_CHANNEL = 'RABBITMQ_CHANNEL';
export const RABBITMQ_CONNECTION = 'RABBITMQ_CONNECTION';

export const EXCHANGES = {
  EVENTS: 'events',
  USERS: 'users',
} as const;

export const QUEUES = {
  BET_RESOLUTION: 'bet-resolution',
  USER_BALANCE: 'user-balance',
} as const;

export const ROUTING_KEYS = {
  EVENT_FINISHED: 'event.finished',
  EVENT_CANCELLED: 'event.cancelled',
  USER_REPLENISH: 'user.replenish',
} as const;

@Global()
@Module({
  providers: [
    {
      provide: RABBITMQ_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>(
          'RABBITMQ_URL',
          'amqp://guest:guest@localhost:5777',
        );
        return amqp.connect([url]);
      },
    },
    {
      provide: RABBITMQ_CHANNEL,
      inject: [RABBITMQ_CONNECTION],
      useFactory: async (connection: amqp.AmqpConnectionManager) => {
        const channel = connection.createChannel({
          json: true,
          setup: async (ch: ConfirmChannel) => {
            await ch.assertExchange(EXCHANGES.EVENTS, 'topic', {
              durable: true,
            });
            await ch.assertExchange(EXCHANGES.USERS, 'topic', {
              durable: true,
            });

            await ch.assertQueue(QUEUES.BET_RESOLUTION, { durable: true });
            await ch.bindQueue(
              QUEUES.BET_RESOLUTION,
              EXCHANGES.EVENTS,
              ROUTING_KEYS.EVENT_FINISHED,
            );
            await ch.bindQueue(
              QUEUES.BET_RESOLUTION,
              EXCHANGES.EVENTS,
              ROUTING_KEYS.EVENT_CANCELLED,
            );

            await ch.assertQueue(QUEUES.USER_BALANCE, { durable: true });
            await ch.bindQueue(
              QUEUES.USER_BALANCE,
              EXCHANGES.USERS,
              ROUTING_KEYS.USER_REPLENISH,
            );
          },
        });

        await channel.waitForConnect();
        return channel;
      },
    },
  ],
  exports: [RABBITMQ_CHANNEL, RABBITMQ_CONNECTION],
})
export class RabbitMQModule implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQModule.name);

  constructor(
    @Inject(RABBITMQ_CONNECTION)
    private connection: amqp.AmqpConnectionManager,
  ) {
    this.logger.log('RabbitMQ module initialized');
  }

  async onModuleDestroy() {
    await this.connection.close();
  }
}
