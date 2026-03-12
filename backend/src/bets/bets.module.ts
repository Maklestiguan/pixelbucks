import { Module } from '@nestjs/common';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { BetResolverConsumer } from './bet-resolver.consumer';

@Module({
  controllers: [BetsController],
  providers: [BetsService, BetResolverConsumer],
  exports: [BetsService],
})
export class BetsModule {}
