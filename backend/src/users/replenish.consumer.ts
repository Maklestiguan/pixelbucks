import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { UsersService } from './users.service';
import { RABBITMQ_CONNECTION, QUEUES } from '../rabbitmq/rabbitmq.module';

@Injectable()
export class ReplenishConsumer implements OnModuleInit {
  private readonly logger = new Logger(ReplenishConsumer.name);

  constructor(
    @Inject(RABBITMQ_CONNECTION) private connection: AmqpConnectionManager,
    private usersService: UsersService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const channel = this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.consume(
          QUEUES.USER_BALANCE,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
              const payload = JSON.parse(msg.content.toString()) as {
                userId: string;
              };
              const routingKey = msg.fields.routingKey;

              if (routingKey === 'user.replenish') {
                await this.usersService.replenishUser(payload.userId);
              }

              ch.ack(msg);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.error(
                `Error processing replenish message: ${message}`,
              );
              ch.nack(msg, false, true);
            }
          },
          { noAck: false },
        );
      },
    });

    this.logger.log('Replenish consumer started');
  }
}
