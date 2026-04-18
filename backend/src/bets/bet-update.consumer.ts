import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma';
import { BalanceAuditService } from '../balance-audit';
import {
  RABBITMQ_CONNECTION,
  RABBITMQ_CHANNEL,
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
} from '../rabbitmq/rabbitmq.module';

interface BetUpdateMessage {
  betId: string;
  userId: string;
  action: 'won' | 'lost' | 'refund';
  amount: number;
  payout: number;
  oddsAtPlacement: number;
}

function isBetUpdateMessage(value: unknown): value is BetUpdateMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.betId === 'string' &&
    typeof v.userId === 'string' &&
    (v.action === 'won' || v.action === 'lost' || v.action === 'refund') &&
    typeof v.amount === 'number' &&
    typeof v.payout === 'number'
  );
}

const LOCK_TTL_SECONDS = 5;
const PREFETCH = 10;

@Injectable()
export class BetUpdateConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BetUpdateConsumer.name);
  private redis!: Redis;

  constructor(
    @Inject(RABBITMQ_CONNECTION) private connection: AmqpConnectionManager,
    @Inject(RABBITMQ_CHANNEL) private channel: ChannelWrapper,
    private prisma: PrismaService,
    private balanceAudit: BalanceAuditService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6777',
    );
    this.redis = new Redis(redisUrl);

    const channel = this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.prefetch(PREFETCH);
        await ch.consume(
          QUEUES.BET_UPDATES,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
              const raw: unknown = JSON.parse(msg.content.toString());

              if (!isBetUpdateMessage(raw)) {
                this.logger.error(
                  `Invalid bet update message: ${msg.content.toString()}`,
                );
                ch.nack(msg, false, false);
                return;
              }

              const payload = raw;

              const lockKey = `bet-update:lock:${payload.userId}`;
              const locked = await this.redis.set(
                lockKey,
                '1',
                'EX',
                LOCK_TTL_SECONDS,
                'NX',
              );

              if (!locked) {
                // Another message for this user is being processed — requeue
                ch.nack(msg, false, true);
                return;
              }

              try {
                await this.processBetUpdate(payload);
                ch.ack(msg);
              } finally {
                await this.redis.del(lockKey);
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.error(`Error processing bet update: ${message}`);
              ch.nack(msg, false, true);
            }
          },
          { noAck: false },
        );
      },
    });

    // Wait for channel to be ready
    await channel.waitForConnect();
    this.logger.log('Bet update consumer started');
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private async processBetUpdate(payload: BetUpdateMessage) {
    const { betId, userId, action, amount, payout } = payload;

    // Atomic idempotency guard: only the first delivery transitions
    // balanceAppliedAt from null → now. Duplicates return count 0 and skip
    // all balance/profit side effects. Assumes resolution is terminal —
    // event.cancelled is only ever published for PENDING events today.
    if (action === 'won') {
      const profit = payout - amount;

      const { count } = await this.prisma.bet.updateMany({
        where: { id: betId, balanceAppliedAt: null },
        data: { status: 'WON', payout, balanceAppliedAt: new Date() },
      });

      if (count === 0) {
        this.logger.warn(`Bet ${betId}: WON skipped (already applied)`);
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: payout },
          totalProfit: { increment: profit },
        },
      });

      this.logger.debug(
        `Bet ${betId}: WON — payout ${payout}, profit ${profit}`,
      );

      this.balanceAudit
        .log({ userId, amount: payout, reason: 'bet_won', referenceId: betId })
        .catch(() => {});

      this.channel
        .publish(EXCHANGES.USERS, ROUTING_KEYS.CHALLENGE_PROGRESS, {
          userId,
          action: 'win_bet',
        })
        .catch(() => {});
    }

    if (action === 'lost') {
      // Status is already LOST (bulk-set by BetsService.resolveEventBets).
      // balanceAppliedAt is the only idempotency signal for the profit decrement.
      const { count } = await this.prisma.bet.updateMany({
        where: { id: betId, balanceAppliedAt: null },
        data: { balanceAppliedAt: new Date() },
      });

      if (count === 0) {
        this.logger.warn(`Bet ${betId}: LOST skipped (already applied)`);
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { totalProfit: { decrement: amount } },
      });

      this.logger.debug(
        `Bet ${betId}: LOST — totalProfit decremented by ${amount}`,
      );
    }

    if (action === 'refund') {
      const { count } = await this.prisma.bet.updateMany({
        where: { id: betId, balanceAppliedAt: null },
        data: {
          status: 'CANCELLED',
          payout: 0,
          balanceAppliedAt: new Date(),
        },
      });

      if (count === 0) {
        this.logger.warn(`Bet ${betId}: REFUND skipped (already applied)`);
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } },
      });

      this.logger.debug(`Bet ${betId}: REFUNDED — amount ${amount}`);

      this.balanceAudit
        .log({ userId, amount, reason: 'bet_refund', referenceId: betId })
        .catch(() => {});
    }
  }
}
