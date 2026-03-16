import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { BetsService } from './bets.service';
import { RABBITMQ_CONNECTION, QUEUES } from '../rabbitmq/rabbitmq.module';

@Injectable()
export class BetResolverConsumer implements OnModuleInit {
  private readonly logger = new Logger(BetResolverConsumer.name);

  constructor(
    @Inject(RABBITMQ_CONNECTION) private connection: AmqpConnectionManager,
    private betsService: BetsService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const channel = this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.consume(
          QUEUES.BET_RESOLUTION,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
              const payload = JSON.parse(msg.content.toString());
              const routingKey = msg.fields.routingKey;

              this.logger.log(
                `Received ${routingKey}: ${JSON.stringify(payload)}`,
              );

              if (routingKey === 'event.finished') {
                await this.betsService.resolveEventBets(
                  payload.eventId,
                  payload.winnerId,
                );
              } else if (routingKey === 'event.cancelled') {
                await this.betsService.refundEventBets(payload.eventId);
              }

              ch.ack(msg);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.error(`Error processing message: ${message}`);
              ch.nack(msg, false, true); // requeue
            }
          },
          { noAck: false },
        );
      },
    });

    this.logger.log('Bet resolver consumer started');
  }
}
