import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { PandascoreService } from './pandascore.service';
import type { MatchStatus } from '@prisma/client';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private pandascore: PandascoreService,
  ) {}

  async listEvents(params: {
    game?: string;
    status?: MatchStatus;
    page?: number;
    limit?: number;
  }) {
    const { game, status, page = 1, limit = 20 } = params;
    const where: any = {};
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
      data: events.map(this.formatEvent),
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
        this.logger.error(
          `Failed to upsert tournament ${t.id}: ${message}`,
        );
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
      this.logger.warn('No synced tournaments — skipping match sync. Run sync-tournaments first.');
      return { synced: 0, dota2: 0, cs2: 0 };
    }

    // Filter by tournament_id in PandaScore request so we only get tier S/A matches
    const [dota2Matches, cs2Matches] = await Promise.all([
      this.pandascore.getUpcomingMatches('dota2', { tournamentIds: pandascoreIds }),
      this.pandascore.getUpcomingMatches('csgo', { tournamentIds: pandascoreIds }),
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
            // Default 1.90/1.90 — admins can adjust via PATCH /api/admin/events/:id
            oddsA: 1.9,
            oddsB: 1.9,
            rawData: match as any,
          },
          update: {
            tournament:
              match.tournament?.name || match.league?.name || 'Unknown',
            tournamentId: tournamentDbId || null,
            teamA: match.opponents[0].opponent.name,
            teamALogo: match.opponents[0].opponent.image_url,
            teamB: match.opponents[1].opponent.name,
            teamBLogo: match.opponents[1].opponent.image_url,
            scheduledAt: new Date(
              match.scheduled_at || match.begin_at || new Date(),
            ),
            rawData: match as any,
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

    const runningIds = new Set(
      [...dota2Running, ...cs2Running].map((m) => m.id),
    );

    if (runningIds.size === 0) return { updated: 0 };

    // Find UPCOMING events whose PandaScore match is now running
    const upcomingEvents = await this.prisma.event.findMany({
      where: {
        status: 'UPCOMING',
        pandascoreId: { in: [...runningIds] },
      },
      select: { id: true, pandascoreId: true },
    });

    let updated = 0;
    for (const event of upcomingEvents) {
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: 'LIVE' },
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
      const game = event.game === 'dota2' ? 'dota2' : 'csgo';
      const match = await this.pandascore.getMatch(
        game as 'dota2' | 'csgo',
        event.pandascoreId,
      );

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
        const winnerId =
          match.winner_id === match.opponents?.[0]?.opponent?.id ? 'a' : 'b';

        // If it's a draw (equal scores), treat as cancelled
        const scores = match.results || [];
        const isDraw =
          scores.length >= 2 && scores[0].score === scores[1].score;

        if (isDraw) {
          await this.cancelEvent(event.id);
          cancelled++;
        } else {
          await this.finishEvent(event.id, winnerId);
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

  private async finishEvent(eventId: string, winnerId: string) {
    await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: eventId },
        data: { status: 'FINISHED', winnerId },
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

  private formatEvent(event: any) {
    return {
      id: event.id,
      pandascoreId: event.pandascoreId,
      game: event.game,
      tournament: event.tournament,
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
      maxBet: event.maxBet,
    };
  }
}
