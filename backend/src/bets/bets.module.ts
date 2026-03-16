import { Module } from '@nestjs/common';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { BetResolverConsumer } from './bet-resolver.consumer';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [ChallengesModule],
  controllers: [BetsController],
  providers: [BetsService, BetResolverConsumer],
  exports: [BetsService],
})
export class BetsModule {}
