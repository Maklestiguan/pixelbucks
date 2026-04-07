import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { PrismaService } from '../prisma';
import { BalanceAuditService } from '../balance-audit';
import { SettingsService } from '../settings';
import {
  RABBITMQ_CHANNEL,
  EXCHANGES,
  ROUTING_KEYS,
} from '../rabbitmq/rabbitmq.module';
import { PlaceBetDto } from './dto';
import { pMap } from '../common/utils/pmap';

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(
    private prisma: PrismaService,
    private balanceAudit: BalanceAuditService,
    private settings: SettingsService,
    @Inject(RABBITMQ_CHANNEL) private channel: ChannelWrapper,
  ) {}

  async placeBet(userId: string, dto: PlaceBetDto) {
    if (!['a', 'b'].includes(dto.selection)) {
      throw new BadRequestException('Selection must be "a" or "b"');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: dto.eventId } });

      if (!event) {
        throw new BadRequestException('Event not found');
      }

      const isUpcoming = event.status === 'UPCOMING';
      const isLiveBettingOpen =
        event.status === 'LIVE' &&
        event.bettingOpenUntil &&
        event.bettingOpenUntil > new Date();

      if (!isUpcoming && !isLiveBettingOpen) {
        throw new BadRequestException('Event is not available for betting');
      }

      // 5 minute buffer before match start (only for UPCOMING events)
      if (isUpcoming) {
        const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
        if (event.scheduledAt <= fiveMinFromNow) {
          throw new BadRequestException('Betting is closed for this event');
        }
      }

      if (dto.amount <= 0 || dto.amount > event.maxBet) {
        throw new BadRequestException(
          `Bet amount must be between 0.01 and ${(event.maxBet / 100).toFixed(2)} PB`,
        );
      }

      // Check user's total bets on this event
      const existingBetsSum = await tx.bet.aggregate({
        where: { userId, eventId: dto.eventId, status: 'PENDING' },
        _sum: { amount: true },
      });

      const totalExisting = existingBetsSum._sum.amount || 0;
      if (totalExisting + dto.amount > event.maxBet) {
        throw new BadRequestException(
          `Total bets on this event would exceed limit of ${(event.maxBet / 100).toFixed(2)} PB. Current total: ${(totalExisting / 100).toFixed(2)} PB`,
        );
      }

      // CS2 events require HLTV-sourced odds before betting is allowed —
      // unless the global "allow CS2 bets without HLTV" admin switch is on.
      if (event.game === 'cs2' && !event.hltvId) {
        const { cs2AllowBetsWithoutHltv } = await this.settings.get();
        if (!cs2AllowBetsWithoutHltv) {
          throw new BadRequestException(
            'Betting not available yet — waiting for odds data',
          );
        }
      }

      // Snapshot odds
      const odds = dto.selection === 'a' ? event.oddsA : event.oddsB;
      if (!odds) {
        throw new BadRequestException('Odds not available for this selection');
      }

      // Atomically deduct balance only if sufficient — prevents negative balance under concurrent bets
      const deducted = await tx.user.updateMany({
        where: { id: userId, balance: { gte: dto.amount } },
        data: { balance: { decrement: dto.amount } },
      });
      if (deducted.count === 0) {
        throw new BadRequestException('Insufficient balance');
      }

      const bet = await tx.bet.create({
        data: {
          userId,
          eventId: dto.eventId,
          amount: dto.amount,
          selection: dto.selection,
          oddsAtPlacement: odds,
        },
      });

      return {
        ...bet,
        game: event.game,
        potentialPayout: Math.floor(bet.amount * bet.oddsAtPlacement),
      };
    });

    // Audit log via RabbitMQ (fire-and-forget)
    this.balanceAudit
      .log({
        userId,
        amount: -dto.amount,
        reason: 'bet_placed',
        referenceId: result.id,
      })
      .catch(() => {});

    // Track challenge progress via RabbitMQ (fire-and-forget)
    const betMeta = { game: result.game, eventId: dto.eventId };
    this.channel
      .publish(EXCHANGES.USERS, ROUTING_KEYS.CHALLENGE_PROGRESS, {
        userId,
        action: 'place_bet',
        amount: 1,
        meta: betMeta,
      })
      .catch(() => {});
    this.channel
      .publish(EXCHANGES.USERS, ROUTING_KEYS.CHALLENGE_PROGRESS, {
        userId,
        action: 'total_wagered',
        amount: dto.amount,
      })
      .catch(() => {});

    return result;
  }

  async getMyBets(
    userId: string,
    params: { status?: string; page?: number; limit?: number },
  ) {
    const { status, page = 1, limit = 20 } = params;
    const where: { [key: string]: string } = { userId };
    if (status) where.status = status;

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          event: {
            select: {
              id: true,
              game: true,
              tournament: true,
              teamA: true,
              teamB: true,
              scheduledAt: true,
              status: true,
              winnerId: true,
            },
          },
        },
      }),
      this.prisma.bet.count({ where }),
    ]);

    return {
      data: bets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getActiveBets(userId: string) {
    return this.prisma.bet.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            game: true,
            tournament: true,
            teamA: true,
            teamB: true,
            scheduledAt: true,
            status: true,
          },
        },
      },
    });
  }

  async resolveEventBets(eventId: string, winnerId: string) {
    const pendingBets = await this.prisma.bet.findMany({
      where: { eventId, status: 'PENDING' },
    });

    if (pendingBets.length === 0) return;

    // Bulk update losing bets (one query)
    await this.prisma.bet.updateMany({
      where: { eventId, status: 'PENDING', selection: { not: winnerId } },
      data: { status: 'LOST', payout: 0 },
    });

    const losingBets = pendingBets.filter((b) => b.selection !== winnerId);
    const winningBets = pendingBets.filter((b) => b.selection === winnerId);

    // Publish per-bet messages for all bets
    await pMap(
      losingBets,
      (bet) =>
        this.channel.publish(EXCHANGES.EVENTS, ROUTING_KEYS.BET_UPDATE, {
          betId: bet.id,
          userId: bet.userId,
          action: 'lost',
          amount: bet.amount,
          payout: 0,
          oddsAtPlacement: bet.oddsAtPlacement,
        }),
      { concurrency: 5 },
    );

    await pMap(
      winningBets,
      (bet) => {
        const payout = Math.floor(bet.amount * bet.oddsAtPlacement);
        return this.channel.publish(EXCHANGES.EVENTS, ROUTING_KEYS.BET_UPDATE, {
          betId: bet.id,
          userId: bet.userId,
          action: 'won',
          amount: bet.amount,
          payout,
          oddsAtPlacement: bet.oddsAtPlacement,
        });
      },
      { concurrency: 5 },
    );

    this.logger.log(
      `Resolved event ${eventId}: ${losingBets.length} lost, ${winningBets.length} won (all queued)`,
    );
  }

  async refundEventBets(eventId: string) {
    const pendingBets = await this.prisma.bet.findMany({
      where: { eventId, status: 'PENDING' },
    });

    if (pendingBets.length === 0) return;

    // Publish per-bet refund messages
    await pMap(
      pendingBets,
      (bet) =>
        this.channel.publish(EXCHANGES.EVENTS, ROUTING_KEYS.BET_UPDATE, {
          betId: bet.id,
          userId: bet.userId,
          action: 'refund',
          amount: bet.amount,
          payout: 0,
          oddsAtPlacement: bet.oddsAtPlacement,
        }),
      { concurrency: 5 },
    );

    this.logger.log(
      `Refund event ${eventId}: ${pendingBets.length} bets queued for refund`,
    );
  }
}
