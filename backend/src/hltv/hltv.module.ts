import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HltvService } from './hltv.service';
import { HltvProxyService } from './hltv-proxy.service';
import { EventsModule } from '../events/events.module';
import {
  HLTV_MAPPING_QUEUE,
  HLTV_ODDS_QUEUE,
  HltvMappingProcessor,
  HltvOddsProcessor,
} from './hltv-sync.processor';

@Module({
  imports: [
    ConfigModule,
    EventsModule,
    BullModule.registerQueue(
      { name: HLTV_MAPPING_QUEUE },
      { name: HLTV_ODDS_QUEUE },
    ),
  ],
  providers: [
    HltvService,
    HltvProxyService,
    HltvMappingProcessor,
    HltvOddsProcessor,
  ],
  exports: [HltvService],
})
export class HltvModule implements OnModuleInit {
  private readonly logger = new Logger(HltvModule.name);

  constructor(
    @InjectQueue(HLTV_MAPPING_QUEUE) private mappingQueue: Queue,
    @InjectQueue(HLTV_ODDS_QUEUE) private oddsQueue: Queue,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const enabled = this.config.get<string>('HLTV_ENABLED', 'true');
    if (enabled === 'false') {
      this.logger.warn('HLTV integration disabled (HLTV_ENABLED=false)');
      return;
    }

    // Clean slate: remove old repeatable jobs and drain stale delayed/waiting jobs
    for (const queue of [this.mappingQueue, this.oddsQueue]) {
      const jobs = await queue.getRepeatableJobs();
      for (const job of jobs) {
        await queue.removeRepeatableByKey(job.key);
      }
      await queue.drain();
    }

    const mappingInterval = this.config.get<number>(
      'HLTV_MAPPING_INTERVAL_MS',
      10 * 60 * 1000, // 10 minutes
    );
    const oddsInterval = this.config.get<number>(
      'HLTV_ODDS_INTERVAL_MS',
      3 * 60 * 1000, // 3 minutes
    );

    const repeatOpts = {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    };

    // Register repeatable jobs
    await this.mappingQueue.add(
      'map',
      {},
      { repeat: { every: mappingInterval }, ...repeatOpts },
    );
    await this.oddsQueue.add(
      'sync',
      {},
      { repeat: { every: oddsInterval }, ...repeatOpts },
    );

    // Fire one-off jobs to guarantee immediate run on startup
    await this.mappingQueue.add('map-now', {}, repeatOpts);
    await this.oddsQueue.add('sync-now', {}, repeatOpts);

    this.logger.log(
      `HLTV sync jobs registered (mapping: ${mappingInterval}ms, odds: ${oddsInterval}ms)`,
    );
  }
}
