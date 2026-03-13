import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { PandascoreService } from './pandascore.service';
import type { Event as EventModel, MatchStatus, Prisma } from '@prisma/client';

interface RawStream {
  main: boolean;
  language: string;
  embed_url: string | null;
  official: boolean;
  raw_url: string | null;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly defaultMaxBet: number;

  constructor(
    private prisma: PrismaService,
    private pandascore: PandascoreService,
    private config: ConfigService,
  ) {
    // Global default max bet per user per event (cents). Admin can override per event.
    this.defaultMaxBet = this.config.get<number>('GLOBAL_MAX_BET', 10000);
  }

  async listEvents(params: {
    game?: string;
    status?: MatchStatus;
    page?: number;
    limit?: number;
  }) {
    const { game, status, page = 1, limit = 20 } = params;
    const where: Prisma.EventWhereInput = {};
    if (game) where.game = game;
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events.map((e) => this.formatEvent(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEvent(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return this.formatEvent(event);
  }

  async syncTournaments() {
    const [dota2Tournaments, cs2Tournaments] = await Promise.all([
      this.pandascore.getTournaments('dota2'),
      this.pandascore.getTournaments('csgo'),
    ]);

    let synced = 0;
    const allowedTiers = new Set(this.pandascore.tiers);

    for (const t of [...dota2Tournaments, ...cs2Tournaments]) {
      const tier = t.serie?.tier || t.tier || 'unranked';
      if (!allowedTiers.has(tier)) continue;

      const game = t.videogame?.slug === 'dota-2' ? 'dota2' : 'cs2';

      try {
        await this.prisma.tournament.upsert({
          where: { pandascoreId: t.id },
          create: {
            pandascoreId: t.id,
            name: t.name,
            tier,
            game,
          },
          update: {
            name: t.name,
            tier,
          },
        });
        synced++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to upsert tournament ${t.id}: ${message}`);
      }
    }

    this.logger.log(
      `Synced ${synced} tier-filtered tournaments (${dota2Tournaments.length} Dota 2 fetched, ${cs2Tournaments.length} CS2 fetched)`,
    );
    return { synced };
  }

  async syncUpcomingMatches() {
    // Get synced tournament PandaScore IDs + DB IDs for server-side filtering
    const allowedTournaments = await this.prisma.tournament.findMany({
      select: { pandascoreId: true, id: true },
    });
    const tournamentMap = new Map(
      allowedTournaments.map((t) => [t.pandascoreId, t.id]),
    );
    const pandascoreIds = allowedTournaments.map((t) => t.pandascoreId);

    if (pandascoreIds.length === 0) {
      this.logger.warn(
        'No synced tournaments — skipping match sync. Run sync-tournaments first.',
      );
      return { synced: 0, dota2: 0, cs2: 0 };
    }

    // Filter by tournament_id in PandaScore request so we only get tier S/A matches
    const [dota2Matches, cs2Matches] = await Promise.all([
      this.pandascore.getUpcomingMatches('dota2', {
        tournamentIds: pandascoreIds,
      }),
      this.pandascore.getUpcomingMatches('csgo', {
        tournamentIds: pandascoreIds,
      }),
    ]);

    let synced = 0;

    for (const match of [...dota2Matches, ...cs2Matches]) {
      if (match.opponents.length < 2) continue;

      const tournamentDbId = tournamentMap.get(match.tournament?.id);
      const game = match.videogame?.slug === 'dota-2' ? 'dota2' : 'cs2';

      try {
        await this.prisma.event.upsert({
          where: { pandascoreId: match.id },
          create: {
            pandascoreId: match.id,
            game,
            tournament:
              match.tournament?.name || match.league?.name || 'Unknown',
            league: match.league?.name || null,
            tournamentId: tournamentDbId || null,
            teamA: match.opponents[0].opponent.name,
            teamALogo: match.opponents[0].opponent.image_url,
            teamB: match.opponents[1].opponent.name,
            teamBLogo: match.opponents[1].opponent.image_url,
            scheduledAt: new Date(
              match.scheduled_at || match.begin_at || new Date(),
            ),
            status: 'UPCOMING',
            // PandaScore free tier doesn't provide betting odds.
            // Default 1.86/1.86 — admins can adjust via PATCH /api/admin/events/:id
            oddsA: 1.86,
            oddsB: 1.86,
            maxBet: this.defaultMaxBet,
            bestOf: match.number_of_games || null,
            rawData: match as unknown as Prisma.InputJsonValue,
          },
          update: {
            tournament:
              match.tournament?.name || match.league?.name || 'Unknown',
            league: match.league?.name || null,
            tournamentId: tournamentDbId || null,
            teamA: match.opponents[0].opponent.name,
            teamALogo: match.opponents[0].opponent.image_url,
            teamB: match.opponents[1].opponent.name,
            teamBLogo: match.opponents[1].opponent.image_url,
            scheduledAt: new Date(
              match.scheduled_at || match.begin_at || new Date(),
            ),
            bestOf: match.number_of_games || null,
            rawData: match as unknown as Prisma.InputJsonValue,
          },
        });
        synced++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to upsert match ${match.id}: ${message}`);
      }
    }

    this.logger.log(
      `Synced ${synced} matches (${dota2Matches.length} Dota 2, ${cs2Matches.length} CS2)`,
    );
    return { synced, dota2: dota2Matches.length, cs2: cs2Matches.length };
  }

  async detectLiveMatches() {
    // Only check running matches from synced tournaments
    const tournamentIds = (
      await this.prisma.tournament.findMany({ select: { pandascoreId: true } })
    ).map((t) => t.pandascoreId);

    const [dota2Running, cs2Running] = await Promise.all([
      this.pandascore.getRunningMatches('dota2', { tournamentIds }),
      this.pandascore.getRunningMatches('csgo', { tournamentIds }),
    ]);

    const allRunning = [...dota2Running, ...cs2Running];
    const runningMap = new Map(allRunning.map((m) => [m.id, m]));

    if (runningMap.size === 0) return { updated: 0 };

    // Find UPCOMING events whose PandaScore match is now running
    const upcomingEvents = await this.prisma.event.findMany({
      where: {
        status: 'UPCOMING',
        pandascoreId: { in: [...runningMap.keys()] },
      },
      select: { id: true, pandascoreId: true },
    });

    let updated = 0;
    for (const event of upcomingEvents) {
      const match = runningMap.get(event.pandascoreId);
      const updateData: Prisma.EventUpdateInput = {
        status: 'LIVE',
        league: match?.league?.name || null,
      };
      if (match) {
        // Refresh rawData with running match data (includes streams_list)
        updateData.rawData = match as unknown as Prisma.InputJsonValue;
      }
      await this.prisma.event.update({
        where: { id: event.id },
        data: updateData,
      });
      updated++;
    }

    if (updated > 0) {
      this.logger.log(`Marked ${updated} events as LIVE`);
    }
    return { updated };
  }

  async checkMatchResults() {
    // Check both UPCOMING (past scheduled) and LIVE events
    const pendingEvents = await this.prisma.event.findMany({
      where: {
        status: { in: ['UPCOMING', 'LIVE'] },
        scheduledAt: { lt: new Date() },
      },
    });

    if (pendingEvents.length === 0)
      return { checked: 0, finished: 0, cancelled: 0 };

    let finished = 0;
    let cancelled = 0;

    for (const event of pendingEvents) {
      const match = await this.pandascore.getMatch(event.pandascoreId);

      if (!match) continue;

      // If match started but we haven't marked it LIVE yet
      if (match.status === 'running' && event.status === 'UPCOMING') {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { status: 'LIVE' },
        });
        continue;
      }

      if (match.status === 'finished' && match.winner_id) {
        const teamAId = match.opponents?.[0]?.opponent?.id;
        const winnerId = match.winner_id === teamAId ? 'a' : 'b';

        // Extract map scores from results
        const results = match.results || [];
        const scoreA = results.find((r) => r.team_id === teamAId)?.score ?? null;
        const scoreB = results.find((r) => r.team_id !== teamAId)?.score ?? null;

        // If it's a draw (equal scores), treat as cancelled
        const isDraw =
          results.length >= 2 && results[0].score === results[1].score;

        if (isDraw) {
          await this.cancelEvent(event.id);
          cancelled++;
        } else {
          await this.finishEvent(event.id, winnerId, scoreA, scoreB, match.number_of_games);
          finished++;
        }
      } else if (match.status === 'canceled') {
        await this.cancelEvent(event.id);
        cancelled++;
      }
    }

    this.logger.log(
      `Checked ${pendingEvents.length} events: ${finished} finished, ${cancelled} cancelled`,
    );
    return { checked: pendingEvents.length, finished, cancelled };
  }

  private async finishEvent(
    eventId: string,
    winnerId: string,
    scoreA: number | null,
    scoreB: number | null,
    bestOf?: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: eventId },
        data: { status: 'FINISHED', winnerId, scoreA, scoreB, bestOf: bestOf ?? null },
      }),
      this.prisma.outboxEvent.create({
        data: {
          type: 'event.finished',
          payload: { eventId, winnerId },
        },
      }),
    ]);
  }

  private async cancelEvent(eventId: string) {
    await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: eventId },
        data: { status: 'CANCELLED' },
      }),
      this.prisma.outboxEvent.create({
        data: {
          type: 'event.cancelled',
          payload: { eventId },
        },
      }),
    ]);
  }

  private formatEvent(event: EventModel) {
    // Extract en/ru streams from rawData (PandaScore streams_list), deduplicated by embed_url
    const rawData = event.rawData as Record<string, unknown> | null;
    const rawStreams: RawStream[] =
      (rawData?.streams_list as RawStream[] | undefined) ?? [];
    const seen = new Set<string>();
    const streams = rawStreams
      .filter(
        (s): s is RawStream & { embed_url: string } =>
          (s.language === 'en' || s.language === 'ru') && !!s.embed_url,
      )
      .filter((s) => {
        if (seen.has(s.embed_url)) return false;
        seen.add(s.embed_url);
        return true;
      })
      .map((s) => ({
        language: s.language,
        embedUrl: s.embed_url,
        rawUrl: s.raw_url ?? '',
        official: s.official,
        main: s.main,
      }));

    return {
      id: event.id,
      pandascoreId: event.pandascoreId,
      game: event.game,
      tournament: event.tournament,
      league: event.league || null,
      tournamentId: event.tournamentId,
      teamA: event.teamA,
      teamALogo: event.teamALogo,
      teamB: event.teamB,
      teamBLogo: event.teamBLogo,
      scheduledAt: event.scheduledAt,
      status: event.status,
      oddsA: event.oddsA,
      oddsB: event.oddsB,
      winnerId: event.winnerId,
      scoreA: event.scoreA,
      scoreB: event.scoreB,
      bestOf: event.bestOf,
      maxBet: event.maxBet,
      bettingOpenUntil: event.bettingOpenUntil?.toISOString() ?? null,
      streams,
    };
  }
}
