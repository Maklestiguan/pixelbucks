import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PandascoreService } from './pandascore.service';
import {
  EventsSyncProcessor,
  EVENTS_SYNC_QUEUE,
} from './events-sync.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: EVENTS_SYNC_QUEUE }),
  ],
  controllers: [EventsController],
  providers: [EventsService, PandascoreService, EventsSyncProcessor],
  exports: [EventsService],
})
export class EventsModule implements OnModuleInit {
  private readonly logger = new Logger(EventsModule.name);

  constructor(
    @InjectQueue(EVENTS_SYNC_QUEUE) private syncQueue: Queue,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    // Remove existing repeatable jobs to avoid duplicates
    const repeatableJobs = await this.syncQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.syncQueue.removeRepeatableByKey(job.key);
    }

    const tournamentsInterval = this.config.get<number>(
      'SYNC_TOURNAMENTS_INTERVAL_MS',
      10 * 180000,
    );
    const matchesInterval = this.config.get<number>(
      'SYNC_MATCHES_INTERVAL_MS',
      10 * 90000,
    );
    const liveInterval = this.config.get<number>(
      'DETECT_LIVE_INTERVAL_MS',
      10 * 12000,
    );
    const resultsInterval = this.config.get<number>(
      'CHECK_RESULTS_INTERVAL_MS',
      10 * 30000,
    );

    const repeatOpts = {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    };

    // Fetch tier S/A tournaments from PandaScore, upsert to DB
    await this.syncQueue.add(
      'sync-tournaments',
      {},
      {
        repeat: { every: tournamentsInterval, immediately: true },
        ...repeatOpts,
      },
    );

    // Fetch upcoming matches, filter by synced tournament IDs, upsert to DB
    await this.syncQueue.add(
      'sync-upcoming-matches',
      {},
      {
        repeat: { every: matchesInterval, immediately: true },
        ...repeatOpts,
      },
    );

    // Check PandaScore for running matches, flip UPCOMING → LIVE
    await this.syncQueue.add(
      'detect-live-matches',
      {},
      {
        repeat: { every: liveInterval, immediately: true },
        ...repeatOpts,
      },
    );

    // Poll finished/cancelled matches, write to outbox for bet resolution
    await this.syncQueue.add(
      'check-match-results',
      {},
      {
        repeat: { every: resultsInterval, immediately: true },
        ...repeatOpts,
      },
    );

    this.logger.log(
      `Events sync jobs registered (tournaments: ${tournamentsInterval}ms, matches: ${matchesInterval}ms, live: ${liveInterval}ms, results: ${resultsInterval}ms)`,
    );
  }
}
