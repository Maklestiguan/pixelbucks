import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { ChallengesProcessor, CHALLENGES_QUEUE } from './challenges.processor';
import { ChallengeProgressConsumer } from './challenge-progress.consumer';

@Module({
  imports: [BullModule.registerQueue({ name: CHALLENGES_QUEUE })],
  controllers: [ChallengesController],
  providers: [
    ChallengesService,
    ChallengesProcessor,
    ChallengeProgressConsumer,
  ],
  exports: [ChallengesService],
})
export class ChallengesModule implements OnModuleInit {
  private readonly logger = new Logger(ChallengesModule.name);

  constructor(@InjectQueue(CHALLENGES_QUEUE) private challengesQueue: Queue) {}

  async onModuleInit() {
    // Clean slate: remove old repeatable jobs and drain stale delayed/waiting jobs
    const jobs = await this.challengesQueue.getRepeatableJobs();
    for (const job of jobs) {
      await this.challengesQueue.removeRepeatableByKey(job.key);
    }
    await this.challengesQueue.drain();

    const interval = 15 * 60 * 1000; // 15 minutes

    const repeatOpts = {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    };

    // Register repeatable job
    await this.challengesQueue.add(
      CHALLENGES_QUEUE,
      {},
      { repeat: { every: interval }, ...repeatOpts },
    );

    // Fire one-off job to guarantee immediate run on startup
    await this.challengesQueue.add(`${CHALLENGES_QUEUE}-now`, {}, repeatOpts);

    this.logger.log(
      `Challenges maintenance job registered (every ${interval}ms)`,
    );
  }
}
