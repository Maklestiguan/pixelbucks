import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReplenishProcessor, REPLENISH_QUEUE } from './replenish.processor';
import { ReplenishConsumer } from './replenish.consumer';

@Module({
  imports: [BullModule.registerQueue({ name: REPLENISH_QUEUE })],
  controllers: [UsersController],
  providers: [UsersService, ReplenishProcessor, ReplenishConsumer],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  private readonly logger = new Logger(UsersModule.name);

  constructor(@InjectQueue(REPLENISH_QUEUE) private replenishQueue: Queue) {}

  async onModuleInit() {
    // Remove old repeatable jobs
    const existing = await this.replenishQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.replenishQueue.removeRepeatableByKey(job.key);
    }

    // Run weekly replenishment check every hour (credits users whose 7-day timer expired)
    await this.replenishQueue.add(
      'weekly-replenish',
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );

    this.logger.log('Weekly replenishment job registered (hourly check)');
  }
}
