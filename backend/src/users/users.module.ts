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
    // Clean slate: remove old repeatable jobs and drain stale delayed/waiting jobs
    const jobs = await this.replenishQueue.getRepeatableJobs();
    for (const job of jobs) {
      await this.replenishQueue.removeRepeatableByKey(job.key);
    }
    await this.replenishQueue.drain();

    const interval = 60 * 60 * 1000; // hourly check (credits users whose 7-day timer expired)

    const repeatOpts = {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    };

    // Register repeatable job
    await this.replenishQueue.add(
      REPLENISH_QUEUE,
      {},
      { repeat: { every: interval }, ...repeatOpts },
    );

    // Fire one-off job to guarantee immediate run on startup
    await this.replenishQueue.add(`${REPLENISH_QUEUE}-now`, {}, repeatOpts);

    this.logger.log(
      `Weekly replenishment job registered (every ${interval}ms)`,
    );
  }
}
