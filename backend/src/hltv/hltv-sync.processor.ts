import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma';
import { HltvService } from './hltv.service';
import { EventsGateway } from '../events/events.gateway';
import { matchTeams, datesClose, normalizeTeamName } from './hltv.team-matcher';

export const HLTV_MAPPING_QUEUE = 'hltv-mapping';
export const HLTV_ODDS_QUEUE = 'hltv-odds';

const TRUSTED_PROVIDERS = ['ggbet', '1xbet', 'thunderpick row', 'bcgame'];

/**
 * Job 1: Tournament mapping (every 10 min)
 *
 * Takes CS2 tournaments from DB that don't have hltvEventId,
 * fetches HLTV events list, matches by name, sets hltvEventId.
 */
@Processor(HLTV_MAPPING_QUEUE)
export class HltvMappingProcessor extends WorkerHost {
  private readonly logger = new Logger(HltvMappingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private hltvService: HltvService,
  ) {
    super();
  }

  async process() {
    this.logger.log('Running HLTV tournament mapping...');

    // Get unmapped CS2 tournaments with their league names from events
    const unmapped = await this.prisma.tournament.findMany({
      where: {
        game: 'cs2',
        hltvEventId: null,
        OR: [{ endAt: null }, { endAt: { gte: new Date() } }],
      },
      select: {
        id: true,
        name: true,
        events: { select: { league: true }, take: 1 },
      },
    });

    this.logger.debug(`Unmapped CS2 tournaments: ${unmapped.length}`);
    if (unmapped.length === 0) {
      this.logger.log('All CS2 tournaments already mapped to HLTV');
      return { mapped: 0 };
    }

    const hltvEvents = await this.hltvService.getEvents();
    if (!hltvEvents || hltvEvents.length === 0) {
      this.logger.warn('No HLTV events returned');
      return { mapped: 0 };
    }

    let mapped = 0;

    for (const tournament of unmapped) {
      // PandaScore tournament.name is "Group A", "Playoffs" etc.
      // The league name (e.g. "BLAST Open") is the real event identifier
      const leagueName = tournament.events[0]?.league;
      const namesToTry = [
        leagueName,
        tournament.name,
        leagueName ? `${leagueName} ${tournament.name}` : null,
      ].filter(Boolean) as string[];

      this.logger.debug(
        `Trying to match tournament "${tournament.name}" (league: "${leagueName ?? 'none'}") — candidates: ${namesToTry.map((n) => `"${normalizeTeamName(n)}"`).join(', ')}`,
      );

      let found = false;
      for (const hltvEvent of hltvEvents) {
        const normEvent = normalizeTeamName(hltvEvent.name);

        for (const name of namesToTry) {
          const norm = normalizeTeamName(name);

          if (
            norm === normEvent ||
            normEvent.includes(norm) ||
            norm.includes(normEvent)
          ) {
            try {
              await this.prisma.tournament.update({
                where: { id: tournament.id },
                data: { hltvEventId: hltvEvent.id },
              });
              mapped++;
              found = true;
              this.logger.log(
                `Mapped tournament "${tournament.name}" (league: "${leagueName}") → HLTV event ${hltvEvent.id} "${hltvEvent.name}"`,
              );
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.warn(
                `Failed to map tournament "${tournament.name}": ${message}`,
              );
            }
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        this.logger.debug(
          `No HLTV match for "${tournament.name}" (league: "${leagueName}"). HLTV events: ${hltvEvents.map((e) => `"${e.name}"`).join(', ')}`,
        );
      }
    }

    this.logger.log(`Tournament mapping done: ${mapped}/${unmapped.length}`);
    return { mapped };
  }
}

/**
 * Job 2: Match sync + odds (single queue, two job types)
 *
 * Scheduler job (repeating, every 3 min):
 *   - Fetches HLTV event pages for mapped tournaments
 *   - Maps unmapped events by team name + date
 *   - Enqueues individual per-event odds jobs
 *
 * Per-event odds job (atomic):
 *   - Fetches getMatch(hltvId) for ONE event
 *   - Computes odds from trusted providers
 *   - Updates DB + invalidates cache
 *
 * BullMQ processes jobs serially. The HltvService rate limiter
 * spaces out requests. All events eventually get odds.
 */
@Processor(HLTV_ODDS_QUEUE)
export class HltvOddsProcessor extends WorkerHost {
  private readonly logger = new Logger(HltvOddsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private hltvService: HltvService,
    private eventsGateway: EventsGateway,
    @Inject(CACHE_MANAGER) private cache: Cache,
    @InjectQueue(HLTV_ODDS_QUEUE) private oddsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    // Per-event odds job
    if (job.data?.eventId) {
      return this.updateSingleEventOdds(job.data);
    }
    // Scheduler job: map matches + enqueue odds jobs
    return this.scheduleOddsJobs();
  }

  /** Scheduler: fetch event pages, map matches, enqueue per-event odds jobs */
  private async scheduleOddsJobs() {
    this.logger.log('Running HLTV match sync + odds scheduling...');

    const tournaments = await this.prisma.tournament.findMany({
      where: {
        game: 'cs2',
        hltvEventId: { not: null },
        OR: [{ endAt: null }, { endAt: { gte: new Date() } }],
      },
      select: { id: true, hltvEventId: true, name: true },
    });

    if (tournaments.length === 0) {
      this.logger.debug('No mapped CS2 tournaments');
      return { matchesMapped: 0, oddsEnqueued: 0 };
    }

    this.logger.debug(
      `Processing ${tournaments.length} tournaments: ${tournaments.map((t) => `"${t.name}" (HLTV ${t.hltvEventId})`).join(', ')}`,
    );

    const ourEvents = await this.prisma.event.findMany({
      where: {
        game: 'cs2',
        status: { in: ['UPCOMING', 'LIVE'] },
        tournamentId: { in: tournaments.map((t) => t.id) },
      },
      select: {
        id: true,
        hltvId: true,
        teamA: true,
        teamB: true,
        scheduledAt: true,
        tournamentId: true,
        oddsA: true,
        oddsB: true,
      },
    });

    this.logger.debug(
      `Active CS2 events: ${ourEvents.length} total, ${ourEvents.filter((e) => !e.hltvId).length} unmapped`,
    );

    const eventsByTournament = new Map<string, typeof ourEvents>();
    for (const event of ourEvents) {
      if (!event.tournamentId) continue;
      const list = eventsByTournament.get(event.tournamentId) || [];
      list.push(event);
      eventsByTournament.set(event.tournamentId, list);
    }

    let matchesMapped = 0;
    let oddsEnqueued = 0;

    // Deduplicate HLTV event fetches
    const hltvEventCache = new Map<
      number,
      Awaited<ReturnType<typeof this.hltvService.getEventMatches>>
    >();

    for (const tournament of tournaments) {
      const hltvEventId = tournament.hltvEventId!;

      if (!hltvEventCache.has(hltvEventId)) {
        this.logger.debug(
          `Fetching HLTV event ${hltvEventId} for "${tournament.name}"...`,
        );
        const result = await this.hltvService.getEventMatches(hltvEventId);
        hltvEventCache.set(hltvEventId, result);
      }
      const hltvMatches = hltvEventCache.get(hltvEventId);
      if (!hltvMatches) continue;

      // Detect ended events
      const hasActive = hltvMatches.some(
        (m) => m.live || (m.date && m.date > Date.now()),
      );
      if (hltvMatches.length > 0 && !hasActive) {
        this.logger.log(
          `HLTV event "${tournament.name}" has ended — setting endAt`,
        );
        await this.prisma.tournament.update({
          where: { id: tournament.id },
          data: { endAt: new Date() },
        });
        continue;
      }

      // Map unmapped events
      const events = eventsByTournament.get(tournament.id) || [];
      const unmappedEvents = events.filter((e) => !e.hltvId);

      for (const event of unmappedEvents) {
        for (const hltvMatch of hltvMatches) {
          if (!hltvMatch.team1?.name || !hltvMatch.team2?.name) continue;

          const result = matchTeams(
            hltvMatch.team1.name,
            hltvMatch.team2.name,
            event.teamA,
            event.teamB,
          );

          if (!result.matched) continue;
          if (hltvMatch.date && !datesClose(event.scheduledAt, hltvMatch.date))
            continue;

          try {
            await this.prisma.event.update({
              where: { id: event.id },
              data: { hltvId: hltvMatch.id },
            });
            event.hltvId = hltvMatch.id;
            matchesMapped++;
            this.logger.log(
              `Mapped "${event.teamA} vs ${event.teamB}" → HLTV match ${hltvMatch.id}`,
            );
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Failed to map ${event.id} → HLTV ${hltvMatch.id}: ${message}`,
            );
          }
          break;
        }
      }

      // Enqueue per-event odds jobs for all mapped events
      const mappedEvents = events.filter((e) => !!e.hltvId);
      for (const event of mappedEvents) {
        await this.oddsQueue.add(
          'odds-single',
          {
            eventId: event.id,
            hltvId: event.hltvId,
            teamA: event.teamA,
            teamB: event.teamB,
            oddsA: event.oddsA,
            oddsB: event.oddsB,
          },
          {
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 50 },
          },
        );
        oddsEnqueued++;
      }
    }

    this.logger.log(
      `HLTV sync: ${matchesMapped} mapped, ${oddsEnqueued} odds jobs enqueued`,
    );
    return { matchesMapped, oddsEnqueued };
  }

  /** Atomic: fetch odds for a single event and update DB */
  private async updateSingleEventOdds(data: {
    eventId: string;
    hltvId: number;
    teamA: string;
    teamB: string;
    oddsA: number | null;
    oddsB: number | null;
  }) {
    const match = await this.hltvService.getMatch(data.hltvId);
    if (!match || !match.odds || match.odds.length === 0) {
      this.logger.debug(
        `No odds for "${data.teamA} vs ${data.teamB}" (HLTV ${data.hltvId})`,
      );
      return { updated: false };
    }

    const validOdds = match.odds.filter(
      (o) =>
        o.team1 > 0 &&
        o.team2 > 0 &&
        TRUSTED_PROVIDERS.includes(o.provider.toLowerCase().trim()),
    );

    if (validOdds.length === 0) {
      this.logger.debug(
        `No trusted provider odds for "${data.teamA} vs ${data.teamB}"`,
      );
      return { updated: false };
    }

    let avgTeam1 =
      validOdds.reduce((sum, o) => sum + o.team1, 0) / validOdds.length;
    let avgTeam2 =
      validOdds.reduce((sum, o) => sum + o.team2, 0) / validOdds.length;

    const teamResult = matchTeams(
      match.team1?.name ?? '',
      match.team2?.name ?? '',
      data.teamA,
      data.teamB,
    );

    if (teamResult.swapped) {
      [avgTeam1, avgTeam2] = [avgTeam2, avgTeam1];
    }

    const oddsA = Math.round(avgTeam1 * 100) / 100;
    const oddsB = Math.round(avgTeam2 * 100) / 100;

    if (
      Math.abs((data.oddsA ?? 0) - oddsA) >= 0.01 ||
      Math.abs((data.oddsB ?? 0) - oddsB) >= 0.01
    ) {
      await this.prisma.event.update({
        where: { id: data.eventId },
        data: { oddsA, oddsB },
      });
      await this.cache.del(`events:detail:${data.eventId}`);
      this.eventsGateway.broadcastOddsUpdate(data.eventId, oddsA, oddsB);
      this.logger.log(
        `Odds "${data.teamA} vs ${data.teamB}": ${oddsA}/${oddsB} (${validOdds.length} providers)`,
      );
      return { updated: true };
    }

    return { updated: false };
  }
}
