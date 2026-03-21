import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { EventsGateway } from './events.gateway';
import { RABBITMQ_CONNECTION, QUEUES } from '../rabbitmq/rabbitmq.module';

interface BalanceNotifyMessage {
  userId: string;
  balance: number;
}

function isBalanceNotifyMessage(value: unknown): value is BalanceNotifyMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).userId === 'string' &&
    typeof (value as Record<string, unknown>).balance === 'number'
  );
}

@Injectable()
export class BalanceNotifyConsumer implements OnModuleInit {
  private readonly logger = new Logger(BalanceNotifyConsumer.name);

  constructor(
    @Inject(RABBITMQ_CONNECTION) private connection: AmqpConnectionManager,
    private eventsGateway: EventsGateway,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.consume(
          QUEUES.BALANCE_NOTIFY,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises, @typescript-eslint/require-await
          async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
              const raw: unknown = JSON.parse(msg.content.toString());

              if (!isBalanceNotifyMessage(raw)) {
                this.logger.error(
                  `Invalid balance notify message: ${msg.content.toString()}`,
                );
                ch.nack(msg, false, false);
                return;
              }

              this.eventsGateway.sendBalanceUpdate(raw.userId, raw.balance);
              ch.ack(msg);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.error(`Error processing balance notify: ${message}`);
              ch.nack(msg, false, false); // discard — no point retrying a socket push
            }
          },
          { noAck: false },
        );
      },
    });

    this.logger.log('Balance notify consumer started');
  }
}
