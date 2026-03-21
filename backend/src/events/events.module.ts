import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsGateway } from './events.gateway';
import { BalanceNotifyConsumer } from './balance-notify.consumer';
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
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
    EventsGateway,
    BalanceNotifyConsumer,
    PandascoreService,
    TournamentsSyncProcessor,
    MatchesSyncProcessor,
    LiveDetectProcessor,
    ResultsCheckProcessor,
  ],
  exports: [EventsService, EventsGateway],
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
    // Clean slate: remove old repeatable jobs and drain stale delayed/waiting jobs
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
      await queue.drain();
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

    // Register repeatable jobs
    await this.tournamentsQueue.add(
      'sync',
      {},
      { repeat: { every: tournamentsInterval }, ...repeatOpts },
    );
    await this.matchesQueue.add(
      'sync',
      {},
      { repeat: { every: matchesInterval }, ...repeatOpts },
    );
    await this.liveQueue.add(
      'detect',
      {},
      { repeat: { every: liveInterval }, ...repeatOpts },
    );
    await this.resultsQueue.add(
      'check',
      {},
      { repeat: { every: resultsInterval }, ...repeatOpts },
    );

    // Fire one-off jobs to guarantee immediate run on startup
    await this.tournamentsQueue.add('sync-now', {}, repeatOpts);
    await this.matchesQueue.add('sync-now', {}, repeatOpts);
    await this.liveQueue.add('detect-now', {}, repeatOpts);
    await this.resultsQueue.add('check-now', {}, repeatOpts);

    this.logger.log(
      `Events sync jobs registered (tournaments: ${tournamentsInterval}ms, matches: ${matchesInterval}ms, live: ${liveInterval}ms, results: ${resultsInterval}ms)`,
    );
  }
}
