import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ChallengesService } from './challenges.service';

export const CHALLENGES_QUEUE = 'challenges';

@Processor(CHALLENGES_QUEUE)
export class ChallengesProcessor extends WorkerHost {
  private readonly logger = new Logger(ChallengesProcessor.name);

  constructor(private challengesService: ChallengesService) {
    super();
  }

  async process() {
    this.logger.log('Running challenges maintenance');
    await this.challengesService.expireChallenges();
    await this.challengesService.generateChallenges();
  }
}
