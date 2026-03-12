import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventsService } from './events.service';

export const EVENTS_SYNC_QUEUE = 'events-sync';

@Processor(EVENTS_SYNC_QUEUE)
export class EventsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EventsSyncProcessor.name);

  constructor(private eventsService: EventsService) {
    super();
  }

  async process(job: any) {
    switch (job.name) {
      case 'sync-tournaments':
        this.logger.log('Running sync-tournaments job');
        return this.eventsService.syncTournaments();

      case 'sync-upcoming-matches':
        this.logger.log('Running sync-upcoming-matches job');
        return this.eventsService.syncUpcomingMatches();

      case 'detect-live-matches':
        this.logger.log('Running detect-live-matches job');
        return this.eventsService.detectLiveMatches();

      case 'check-match-results':
        this.logger.log('Running check-match-results job');
        return this.eventsService.checkMatchResults();

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
