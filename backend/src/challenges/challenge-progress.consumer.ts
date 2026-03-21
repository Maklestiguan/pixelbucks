import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { ChallengesService } from './challenges.service';
import { RABBITMQ_CONNECTION, QUEUES } from '../rabbitmq/rabbitmq.module';

interface ChallengeProgressMessage {
  userId: string;
  action: string;
  amount?: number;
  meta?: Record<string, unknown>;
}

function isChallengeProgressMessage(
  value: unknown,
): value is ChallengeProgressMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).userId === 'string' &&
    typeof (value as Record<string, unknown>).action === 'string'
  );
}

@Injectable()
export class ChallengeProgressConsumer implements OnModuleInit {
  private readonly logger = new Logger(ChallengeProgressConsumer.name);

  constructor(
    @Inject(RABBITMQ_CONNECTION) private connection: AmqpConnectionManager,
    private challengesService: ChallengesService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.consume(
          QUEUES.CHALLENGE_PROGRESS,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
              const raw: unknown = JSON.parse(msg.content.toString());

              if (!isChallengeProgressMessage(raw)) {
                this.logger.error(
                  `Invalid challenge progress message: ${msg.content.toString()}`,
                );
                ch.nack(msg, false, false);
                return;
              }

              await this.challengesService.trackProgress(
                raw.userId,
                raw.action,
                raw.amount,
                raw.meta,
              );

              ch.ack(msg);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.error(
                `Error processing challenge progress: ${message}`,
              );
              ch.nack(msg, false, true);
            }
          },
          { noAck: false },
        );
      },
    });

    this.logger.log('Challenge progress consumer started');
  }
}
