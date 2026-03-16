import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import {
  ChallengesProcessor,
  CHALLENGES_QUEUE,
} from './challenges.processor';

@Module({
  imports: [BullModule.registerQueue({ name: CHALLENGES_QUEUE })],
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengesProcessor],
  exports: [ChallengesService],
})
export class ChallengesModule implements OnModuleInit {
  private readonly logger = new Logger(ChallengesModule.name);

  constructor(
    @InjectQueue(CHALLENGES_QUEUE) private challengesQueue: Queue,
  ) {}

  async onModuleInit() {
    const existing = await this.challengesQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.challengesQueue.removeRepeatableByKey(job.key);
    }

    // Generate/expire challenges every 15 minutes
    await this.challengesQueue.add(
      'maintain-challenges',
      {},
      {
        repeat: { every: 15 * 60 * 1000, immediately: true },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );

    this.logger.log('Challenges maintenance job registered (every 15 min)');
  }
}
