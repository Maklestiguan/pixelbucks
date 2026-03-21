import { Module } from '@nestjs/common';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { BetResolverConsumer } from './bet-resolver.consumer';
import { BetUpdateConsumer } from './bet-update.consumer';

@Module({
  controllers: [BetsController],
  providers: [BetsService, BetResolverConsumer, BetUpdateConsumer],
  exports: [BetsService],
})
export class BetsModule {}
