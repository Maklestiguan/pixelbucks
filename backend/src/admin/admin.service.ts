import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma';
import { EventsService } from '../events/events.service';
import { BalanceAuditService } from '../balance-audit';
import { UpdateEventDto, AdjustBalanceDto, UpdateTournamentDto } from './dto';
import type { MatchStatus, Prisma } from '@prisma/client';
import {
  TOURNAMENTS_QUEUE,
  MATCHES_QUEUE,
  LIVE_QUEUE,
  RESULTS_QUEUE,
} from '../events/events-sync.processor';
import {
  HLTV_MAPPING_QUEUE,
  HLTV_ODDS_QUEUE,
} from '../hltv/hltv-sync.processor';
import { REPLENISH_QUEUE } from '../users/replenish.processor';
import { CHALLENGES_QUEUE } from '../challenges/challenges.processor';

const VALID_STATUSES: MatchStatus[] = [
  'UPCOMING',
  'LIVE',
  'FINISHED',
  'CANCELLED',
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  private readonly queues: { name: string; label: string; queue: Queue }[];

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private balanceAudit: BalanceAuditService,
    @InjectQueue(TOURNAMENTS_QUEUE) tournamentsQueue: Queue,
    @InjectQueue(MATCHES_QUEUE) matchesQueue: Queue,
    @InjectQueue(LIVE_QUEUE) liveQueue: Queue,
    @InjectQueue(RESULTS_QUEUE) resultsQueue: Queue,
    @InjectQueue(HLTV_MAPPING_QUEUE) hltvMappingQueue: Queue,
    @InjectQueue(HLTV_ODDS_QUEUE) hltvOddsQueue: Queue,
    @InjectQueue(REPLENISH_QUEUE) replenishQueue: Queue,
    @InjectQueue(CHALLENGES_QUEUE) challengesQueue: Queue,
    @InjectQueue('chat') chatQueue: Queue,
  ) {
    this.queues = [
      {
        name: TOURNAMENTS_QUEUE,
        label: 'Tournament Sync',
        queue: tournamentsQueue,
      },
      { name: MATCHES_QUEUE, label: 'Match Sync', queue: matchesQueue },
      { name: LIVE_QUEUE, label: 'Live Detection', queue: liveQueue },
      { name: RESULTS_QUEUE, label: 'Results Check', queue: resultsQueue },
      {
        name: HLTV_MAPPING_QUEUE,
        label: 'HLTV Mapping',
        queue: hltvMappingQueue,
      },
      { name: HLTV_ODDS_QUEUE, label: 'HLTV Odds', queue: hltvOddsQueue },
      {
        name: REPLENISH_QUEUE,
        label: 'Weekly Replenish',
        queue: replenishQueue,
      },
      { name: CHALLENGES_QUEUE, label: 'Challenges', queue: challengesQueue },
      { name: 'chat', label: 'Chat Cleanup', queue: chatQueue },
    ];
  }

  async updateEvent(id: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (dto.status && !VALID_STATUSES.includes(dto.status as MatchStatus)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }

    const data: Prisma.EventUpdateInput = {};
    if (dto.oddsA !== undefined) data.oddsA = dto.oddsA;
    if (dto.oddsB !== undefined) data.oddsB = dto.oddsB;
    if (dto.maxBet !== undefined) data.maxBet = dto.maxBet;
    if (dto.status !== undefined) data.status = dto.status as MatchStatus;
    if (dto.hltvId !== undefined) data.hltvId = dto.hltvId;

    // Open betting for N minutes on a LIVE event
    if (dto.bettingOpenMinutes !== undefined) {
      if (dto.bettingOpenMinutes <= 0) {
        // Close betting immediately
        data.bettingOpenUntil = null;
      } else {
        data.bettingOpenUntil = new Date(
          Date.now() + dto.bettingOpenMinutes * 60 * 1000,
        );
      }
    }

    await this.prisma.event.update({ where: { id }, data });

    this.logger.log(`Admin updated event ${id}: ${JSON.stringify(dto)}`);

    // Bust the detail cache so the admin sees the updated event immediately
    await this.eventsService.invalidateEventCache(id);

    // Return the formatted event (with streams, league, etc.)
    return this.eventsService.getEvent(id);
  }

  async listTournaments(params: {
    page?: number;
    limit?: number;
    game?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, game, search } = params;
    const where: Prisma.TournamentWhereInput = {};
    if (game) {
      where.game = game;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [tournaments, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          pandascoreId: true,
          name: true,
          tier: true,
          game: true,
          hltvEventId: true,
          endAt: true,
          createdAt: true,
          _count: { select: { events: true } },
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      data: tournaments.map((t) => ({
        id: t.id,
        pandascoreId: t.pandascoreId,
        name: t.name,
        tier: t.tier,
        game: t.game,
        hltvEventId: t.hltvEventId,
        endAt: t.endAt,
        createdAt: t.createdAt,
        eventsCount: t._count.events,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateTournament(id: string, dto: UpdateTournamentDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const data: Prisma.TournamentUpdateInput = {};
    if (dto.hltvEventId !== undefined) {
      data.hltvEventId = dto.hltvEventId;
    }
    if (dto.endAt !== undefined) {
      data.endAt = dto.endAt;
    }

    const updated = await this.prisma.tournament.update({
      where: { id },
      data,
      select: {
        id: true,
        pandascoreId: true,
        name: true,
        tier: true,
        game: true,
        hltvEventId: true,
        endAt: true,
        createdAt: true,
        _count: { select: { events: true } },
      },
    });

    this.logger.log(`Admin updated tournament ${id}: ${JSON.stringify(dto)}`);

    return {
      id: updated.id,
      pandascoreId: updated.pandascoreId,
      name: updated.name,
      tier: updated.tier,
      game: updated.game,
      hltvEventId: updated.hltvEventId,
      endAt: updated.endAt,
      createdAt: updated.createdAt,
      eventsCount: updated._count.events,
    };
  }

  async listUsers(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = params;
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          role: true,
          balance: true,
          totalProfit: true,
          statsPublic: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        ...u,
        balance: this.formatBalance(u.balance),
        totalProfit: this.formatBalance(u.totalProfit),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserDetails(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        balance: true,
        totalProfit: true,
        statsPublic: true,
        createdAt: true,
        _count: { select: { bets: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      balance: this.formatBalance(user.balance),
      totalProfit: this.formatBalance(user.totalProfit),
      totalBets: user._count.bets,
    };
  }

  async adjustBalance(userId: string, dto: AdjustBalanceDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const newBalance = user.balance + dto.amount;
    if (newBalance < 0) {
      throw new BadRequestException(
        `Cannot debit ${Math.abs(dto.amount)} cents — user only has ${user.balance} cents`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: dto.amount } },
      select: {
        id: true,
        username: true,
        balance: true,
      },
    });

    this.logger.log(
      `Admin adjusted balance for user ${userId}: ${dto.amount > 0 ? '+' : ''}${dto.amount} cents. Reason: ${dto.reason || 'none'}`,
    );

    this.balanceAudit
      .log({
        userId,
        amount: dto.amount,
        reason: 'admin_adjust',
        note: dto.reason,
      })
      .catch(() => {});

    return {
      ...updated,
      balance: this.formatBalance(updated.balance),
    };
  }

  async getPlatformStats() {
    const [totalUsers, totalBets, volumeResult, activeEvents, balanceResult] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.bet.count(),
        this.prisma.bet.aggregate({ _sum: { amount: true } }),
        this.prisma.event.count({
          where: { status: { in: ['UPCOMING', 'LIVE'] } },
        }),
        this.prisma.user.aggregate({ _sum: { balance: true } }),
      ]);

    return {
      totalUsers,
      totalBets,
      totalVolume: this.formatBalance(volumeResult._sum.amount || 0),
      activeEvents,
      totalCirculation: this.formatBalance(balanceResult._sum.balance || 0),
    };
  }

  async getJobSchedules() {
    const results = await Promise.all(
      this.queues.map(async ({ name, label, queue }) => {
        try {
          const [schedulers, completed, active] = await Promise.all([
            queue.getRepeatableJobs(),
            queue.getCompleted(0, 0),
            queue.getActive(0, 0),
          ]);

          const lastCompleted = completed[0];
          let lastRun: string | null = null;
          if (lastCompleted?.finishedOn) {
            const d = new Date(lastCompleted.finishedOn);
            if (!isNaN(d.getTime())) lastRun = d.toISOString();
          }
          const lastRunName = lastCompleted?.name || null;
          const isRunning = active.length > 0;

          if (schedulers.length === 0) {
            return [
              {
                queue: name,
                label,
                jobName: null,
                interval: null,
                cron: null,
                next: null,
                lastRun,
                lastRunName,
                isRunning,
              },
            ];
          }

          return schedulers.map((s) => {
            let next: string | null = null;
            if (s.next) {
              const d = new Date(s.next);
              if (!isNaN(d.getTime())) next = d.toISOString();
            }

            return {
              queue: name,
              label,
              jobName: s.name,
              interval: s.every ? Number(s.every) : null,
              cron: s.pattern || null,
              next,
              lastRun,
              lastRunName,
              isRunning,
            };
          });
        } catch (err) {
          this.logger.warn(`Failed to query queue "${name}": ${err}`);
          return [
            {
              queue: name,
              label,
              jobName: null,
              interval: null,
              cron: null,
              next: null,
              lastRun: null,
              lastRunName: null,
              isRunning: false,
              error: String(err),
            },
          ];
        }
      }),
    );

    return results.flat();
  }

  private formatBalance(cents: number): string {
    return (cents / 100).toFixed(2);
  }
}
