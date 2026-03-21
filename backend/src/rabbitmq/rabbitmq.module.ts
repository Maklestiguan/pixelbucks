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
  // Receives event.finished / event.cancelled → triggers bulk LOST update + fans out per-bet messages
  BET_RESOLUTION: 'bet-resolution',
  // Receives individual bet updates (won/refund) → per-user Redis lock ensures sequential processing
  BET_UPDATES: 'bet-updates',
  // Receives user.replenish → weekly balance top-up per user
  USER_BALANCE: 'user-balance',
  // Receives balance.changed → pushes real-time balance update via Socket.IO to the user
  BALANCE_NOTIFY: 'balance-notify',
  // Receives balance.audit → persists audit record + publishes balance.changed for socket push
  BALANCE_AUDIT: 'balance-audit',
  // Receives challenge.progress → tracks user challenge progress asynchronously
  CHALLENGE_PROGRESS: 'challenge-progress',
} as const;

export const ROUTING_KEYS = {
  // Match finished → outbox publishes → BetResolverConsumer marks losing bets LOST, fans out per-bet won payouts
  EVENT_FINISHED: 'event.finished',
  // Match cancelled/draw → outbox publishes → BetResolverConsumer refunds all bets on that event
  EVENT_CANCELLED: 'event.cancelled',
  // Per-bet payout/refund → BetUpdateConsumer credits winner balance or refunds, with per-user Redis lock
  BET_UPDATE: 'bet.update',
  // Hourly cron triggers → ReplenishConsumer tops up users below threshold (weekly allowance)
  USER_REPLENISH: 'user.replenish',
  // After audit record saved → BalanceNotifyConsumer pushes new balance to user via Socket.IO
  BALANCE_CHANGED: 'balance.changed',
  // Any balance change (bet/win/refund/admin/replenish) → BalanceAuditConsumer persists audit trail row
  BALANCE_AUDIT: 'balance.audit',
  // Bet placed/won → ChallengeProgressConsumer increments daily/weekly challenge counters
  CHALLENGE_PROGRESS: 'challenge.progress',
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

            await ch.assertQueue(QUEUES.BET_UPDATES, { durable: true });
            await ch.bindQueue(
              QUEUES.BET_UPDATES,
              EXCHANGES.EVENTS,
              ROUTING_KEYS.BET_UPDATE,
            );

            await ch.assertQueue(QUEUES.USER_BALANCE, { durable: true });
            await ch.bindQueue(
              QUEUES.USER_BALANCE,
              EXCHANGES.USERS,
              ROUTING_KEYS.USER_REPLENISH,
            );

            await ch.assertQueue(QUEUES.BALANCE_NOTIFY, { durable: true });
            await ch.bindQueue(
              QUEUES.BALANCE_NOTIFY,
              EXCHANGES.USERS,
              ROUTING_KEYS.BALANCE_CHANGED,
            );

            await ch.assertQueue(QUEUES.BALANCE_AUDIT, { durable: true });
            await ch.bindQueue(
              QUEUES.BALANCE_AUDIT,
              EXCHANGES.USERS,
              ROUTING_KEYS.BALANCE_AUDIT,
            );

            await ch.assertQueue(QUEUES.CHALLENGE_PROGRESS, {
              durable: true,
            });
            await ch.bindQueue(
              QUEUES.CHALLENGE_PROGRESS,
              EXCHANGES.USERS,
              ROUTING_KEYS.CHALLENGE_PROGRESS,
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
