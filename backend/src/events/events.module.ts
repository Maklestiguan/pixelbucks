import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PandascoreService } from './pandascore.service';
import {
  TOURNAMENTS_QUEUE,
  MATCHES_QUEUE,
  LIVE_QUEUE,
  RESULTS_QUEUE,
  TournamentsSyncProcessor,
  MatchesSyncProcessor,
  LiveDetectProcessor,
  ResultsCheckProcessor,
} from './events-sync.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: TOURNAMENTS_QUEUE },
      { name: MATCHES_QUEUE },
      { name: LIVE_QUEUE },
      { name: RESULTS_QUEUE },
    ),
  ],
  controllers: [EventsController],
  providers: [
    EventsService,
    PandascoreService,
    TournamentsSyncProcessor,
    MatchesSyncProcessor,
    LiveDetectProcessor,
    ResultsCheckProcessor,
  ],
  exports: [EventsService],
})
export class EventsModule implements OnModuleInit {
  private readonly logger = new Logger(EventsModule.name);

  constructor(
    @InjectQueue(TOURNAMENTS_QUEUE) private tournamentsQueue: Queue,
    @InjectQueue(MATCHES_QUEUE) private matchesQueue: Queue,
    @InjectQueue(LIVE_QUEUE) private liveQueue: Queue,
    @InjectQueue(RESULTS_QUEUE) private resultsQueue: Queue,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    // Remove existing repeatable jobs to avoid duplicates
    for (const queue of [
      this.tournamentsQueue,
      this.matchesQueue,
      this.liveQueue,
      this.resultsQueue,
    ]) {
      const jobs = await queue.getRepeatableJobs();
      for (const job of jobs) {
        await queue.removeRepeatableByKey(job.key);
      }
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

    await this.tournamentsQueue.add(
      'sync',
      {},
      {
        repeat: { every: tournamentsInterval, immediately: true },
        ...repeatOpts,
      },
    );

    await this.matchesQueue.add(
      'sync',
      {},
      {
        repeat: { every: matchesInterval, immediately: true },
        ...repeatOpts,
      },
    );

    await this.liveQueue.add(
      'detect',
      {},
      {
        repeat: { every: liveInterval, immediately: true },
        ...repeatOpts,
      },
    );

    await this.resultsQueue.add(
      'check',
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
