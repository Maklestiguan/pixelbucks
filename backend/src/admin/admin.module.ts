import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EventsModule } from '../events/events.module';
import { FeedbackModule } from '../feedback/feedback.module';
import {
  TOURNAMENTS_QUEUE,
  MATCHES_QUEUE,
  LIVE_QUEUE,
  RESULTS_QUEUE,
} from '../events/events-sync.processor';
import {
  HLTV_MAPPING_QUEUE,
  HLTV_ODDS_QUEUE,
} from '../hltv/hltv-sync.processor';
import { REPLENISH_QUEUE } from '../users/replenish.processor';
import { CHALLENGES_QUEUE } from '../challenges/challenges.processor';

@Module({
  imports: [
    EventsModule,
    FeedbackModule,
    BullModule.registerQueue(
      { name: TOURNAMENTS_QUEUE },
      { name: MATCHES_QUEUE },
      { name: LIVE_QUEUE },
      { name: RESULTS_QUEUE },
      { name: HLTV_MAPPING_QUEUE },
      { name: HLTV_ODDS_QUEUE },
      { name: REPLENISH_QUEUE },
      { name: CHALLENGES_QUEUE },
      { name: 'chat' },
    ),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
