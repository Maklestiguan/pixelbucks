import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { PrismaService } from '../prisma';
import {
  RABBITMQ_CONNECTION,
  RABBITMQ_CHANNEL,
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
} from '../rabbitmq/rabbitmq.module';

interface BalanceAuditMessage {
  userId: string;
  amount: number;
  reason: string;
  referenceId?: string;
  note?: string;
}

function isBalanceAuditMessage(value: unknown): value is BalanceAuditMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).userId === 'string' &&
    typeof (value as Record<string, unknown>).amount === 'number' &&
    typeof (value as Record<string, unknown>).reason === 'string'
  );
}

@Injectable()
export class BalanceAuditConsumer implements OnModuleInit {
  private readonly logger = new Logger(BalanceAuditConsumer.name);

  constructor(
    @Inject(RABBITMQ_CONNECTION) private connection: AmqpConnectionManager,
    @Inject(RABBITMQ_CHANNEL) private channel: ChannelWrapper,
    private prisma: PrismaService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.consume(
          QUEUES.BALANCE_AUDIT,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
              const raw: unknown = JSON.parse(msg.content.toString());

              if (!isBalanceAuditMessage(raw)) {
                this.logger.error(
                  `Invalid balance audit message: ${msg.content.toString()}`,
                );
                ch.nack(msg, false, false);
                return;
              }

              const payload = raw;

              const user = await this.prisma.user.findUnique({
                where: { id: payload.userId },
                select: { balance: true },
              });

              const balanceAfter = user?.balance ?? 0;

              await this.prisma.balanceAudit.create({
                data: {
                  userId: payload.userId,
                  amount: payload.amount,
                  balanceAfter,
                  reason: payload.reason,
                  referenceId: payload.referenceId,
                  note: payload.note,
                },
              });

              // Publish balance.changed for socket notification
              await this.channel.publish(
                EXCHANGES.USERS,
                ROUTING_KEYS.BALANCE_CHANGED,
                { userId: payload.userId, balance: balanceAfter },
              );

              ch.ack(msg);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.error(`Error processing balance audit: ${message}`);
              ch.nack(msg, false, true);
            }
          },
          { noAck: false },
        );
      },
    });

    this.logger.log('Balance audit consumer started');
  }
}
