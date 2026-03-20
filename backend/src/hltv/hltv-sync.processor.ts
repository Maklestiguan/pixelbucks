import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma';
import { HltvService } from './hltv.service';
import { matchTeams, datesClose } from './hltv.team-matcher';

export const HLTV_MAPPING_QUEUE = 'hltv-mapping';
export const HLTV_ODDS_QUEUE = 'hltv-odds';

/**
 * Maps unmapped CS2 UPCOMING/LIVE events to HLTV match IDs.
 * Runs every 10 minutes, uses 1 HLTV request per run.
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
    const unmappedEvents = await this.prisma.event.findMany({
      where: {
        game: 'cs2',
        hltvId: null,
        status: { in: ['UPCOMING', 'LIVE'] },
      },
      select: {
        id: true,
        teamA: true,
        teamB: true,
        scheduledAt: true,
      },
    });

    if (unmappedEvents.length === 0) return { mapped: 0 };

    const hltvMatches = await this.hltvService.getMatches();
    if (!hltvMatches) return { mapped: 0, error: 'HLTV request failed' };

    let mapped = 0;

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

        // Verify date proximity (within 24h)
        if (hltvMatch.date && !datesClose(event.scheduledAt, hltvMatch.date)) {
          continue;
        }

        try {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { hltvId: hltvMatch.id },
          });
          mapped++;
          this.logger.log(
            `Mapped event "${event.teamA} vs ${event.teamB}" → HLTV match ${hltvMatch.id}`,
          );
        } catch (err: unknown) {
          // hltvId unique constraint violation = already mapped
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to map event ${event.id} to HLTV ${hltvMatch.id}: ${message}`,
          );
        }
        break; // Move to next event after finding a match
      }
    }

    this.logger.log(
      `HLTV mapping: ${mapped}/${unmappedEvents.length} events mapped`,
    );
    return { mapped, total: unmappedEvents.length };
  }
}

/**
 * Fetches odds from HLTV for mapped CS2 events.
 * Runs every 3 minutes, uses up to 4 HLTV requests per run.
 */
@Processor(HLTV_ODDS_QUEUE)
export class HltvOddsProcessor extends WorkerHost {
  private readonly logger = new Logger(HltvOddsProcessor.name);
  private readonly MAX_PER_RUN = 4;

  constructor(
    private prisma: PrismaService,
    private hltvService: HltvService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {
    super();
  }

  async process() {
    const events = await this.prisma.event.findMany({
      where: {
        game: 'cs2',
        hltvId: { not: null },
        status: { in: ['UPCOMING', 'LIVE'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: this.MAX_PER_RUN,
      select: {
        id: true,
        hltvId: true,
        teamA: true,
        teamB: true,
        oddsA: true,
        oddsB: true,
      },
    });

    if (events.length === 0) return { updated: 0 };

    let updated = 0;

    for (const event of events) {
      if (!event.hltvId) continue;

      const match = await this.hltvService.getMatch(event.hltvId);
      if (!match || !match.odds || match.odds.length === 0) continue;

      // Only use trusted providers
      const TRUSTED_PROVIDERS = ['ggbet', '1xbet', 'thunderpick row', 'bcgame'];
      const validOdds = match.odds.filter(
        (o) =>
          o.team1 > 0 &&
          o.team2 > 0 &&
          TRUSTED_PROVIDERS.includes(o.provider.toLowerCase().trim()),
      );

      if (validOdds.length === 0) continue;

      // Average odds across providers
      let avgTeam1 =
        validOdds.reduce((sum, o) => sum + o.team1, 0) / validOdds.length;
      let avgTeam2 =
        validOdds.reduce((sum, o) => sum + o.team2, 0) / validOdds.length;

      // Determine team order: check if HLTV team1 matches our teamA
      const teamResult = matchTeams(
        match.team1?.name ?? '',
        match.team2?.name ?? '',
        event.teamA,
        event.teamB,
      );

      // If swapped, HLTV team1 = our teamB, so swap odds
      if (teamResult.swapped) {
        [avgTeam1, avgTeam2] = [avgTeam2, avgTeam1];
      }

      const oddsA = Math.round(avgTeam1 * 100) / 100;
      const oddsB = Math.round(avgTeam2 * 100) / 100;

      // Only update if odds changed meaningfully
      if (
        Math.abs((event.oddsA ?? 0) - oddsA) >= 0.01 ||
        Math.abs((event.oddsB ?? 0) - oddsB) >= 0.01
      ) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { oddsA, oddsB },
        });

        // Invalidate event cache
        await this.cache.del(`events:detail:${event.id}`);

        updated++;
        this.logger.log(
          `Updated odds for "${event.teamA} vs ${event.teamB}": ${oddsA}/${oddsB} (from ${validOdds.length} providers)`,
        );
      }
    }

    this.logger.log(`HLTV odds: updated ${updated}/${events.length} events`);
    return { updated, checked: events.length };
  }
}
