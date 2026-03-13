import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { UsersService } from './users.service';

export const REPLENISH_QUEUE = 'user-replenish';

@Processor(REPLENISH_QUEUE)
export class ReplenishProcessor extends WorkerHost {
  private readonly logger = new Logger(ReplenishProcessor.name);

  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process() {
    this.logger.log('Running weekly replenishment check');

    const userIds = await this.usersService.findReplenishableUsers();
    if (userIds.length === 0) {
      this.logger.log('No users eligible for replenishment');
      return { replenished: 0 };
    }

    // Write outbox events for each user (processed by RabbitMQ consumer)
    for (const userId of userIds) {
      await this.prisma.outboxEvent.create({
        data: {
          type: 'user.replenish',
          payload: { userId },
        },
      });
    }

    this.logger.log(
      `Created ${userIds.length} replenishment outbox events`,
    );
    return { replenished: userIds.length };
  }
}
