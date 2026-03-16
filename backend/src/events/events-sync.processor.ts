import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventsService } from './events.service';

export const TOURNAMENTS_QUEUE = 'events-tournaments';
export const MATCHES_QUEUE = 'events-matches';
export const LIVE_QUEUE = 'events-live';
export const RESULTS_QUEUE = 'events-results';

@Processor(TOURNAMENTS_QUEUE)
export class TournamentsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(TournamentsSyncProcessor.name);
  constructor(private eventsService: EventsService) {
    super();
  }
  async process() {
    this.logger.log('Running sync-tournaments job');
    return this.eventsService.syncTournaments();
  }
}

@Processor(MATCHES_QUEUE)
export class MatchesSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchesSyncProcessor.name);
  constructor(private eventsService: EventsService) {
    super();
  }
  async process() {
    this.logger.log('Running sync-upcoming-matches job');
    return this.eventsService.syncUpcomingMatches();
  }
}

@Processor(LIVE_QUEUE)
export class LiveDetectProcessor extends WorkerHost {
  private readonly logger = new Logger(LiveDetectProcessor.name);
  constructor(private eventsService: EventsService) {
    super();
  }
  async process() {
    this.logger.log('Running detect-live-matches job');
    return this.eventsService.detectLiveMatches();
  }
}

@Processor(RESULTS_QUEUE)
export class ResultsCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(ResultsCheckProcessor.name);
  constructor(private eventsService: EventsService) {
    super();
  }
  async process() {
    this.logger.log('Running check-match-results job');
    return this.eventsService.checkMatchResults();
  }
}
