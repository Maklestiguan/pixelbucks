import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ChallengesService } from '../challenges/challenges.service';
import { PlaceBetDto } from './dto';

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(
    private prisma: PrismaService,
    private challengesService: ChallengesService,
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

    // Track challenge progress (fire-and-forget, don't block the bet response)
    // eventId deduplication: multiple bets on the same event count as 1 toward place_bet challenges
    const betMeta = { game: result.game, eventId: dto.eventId };
    this.challengesService
      .trackProgress(userId, 'place_bet', 1, betMeta)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Challenge tracking failed: ${msg}`);
      });
    this.challengesService
      .trackProgress(userId, 'total_wagered', dto.amount)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Challenge tracking failed: ${msg}`);
      });

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
    const winnerUserIds = await this.prisma.$transaction(async (tx) => {
      const pendingBets = await tx.bet.findMany({
        where: { eventId, status: 'PENDING' },
      });

      for (const bet of pendingBets) {
        const won = bet.selection === winnerId;
        const payout = won ? Math.floor(bet.amount * bet.oddsAtPlacement) : 0;
        const profit = won ? payout - bet.amount : -bet.amount;

        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: won ? 'WON' : 'LOST',
            payout,
          },
        });

        await tx.user.update({
          where: { id: bet.userId },
          data: {
            balance: won ? { increment: payout } : undefined,
            totalProfit: { increment: profit },
          },
        });
      }

      this.logger.log(
        `Resolved ${pendingBets.length} bets for event ${eventId}, winner: ${winnerId}`,
      );

      return [
        ...new Set(
          pendingBets
            .filter((b) => b.selection === winnerId)
            .map((b) => b.userId),
        ),
      ];
    });

    // Track win_bet challenge progress (once per user per event)
    for (const uid of winnerUserIds) {
      this.challengesService.trackProgress(uid, 'win_bet').catch(() => {});
    }
  }

  async refundEventBets(eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pendingBets = await tx.bet.findMany({
        where: { eventId, status: 'PENDING' },
      });

      for (const bet of pendingBets) {
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'CANCELLED', payout: 0 },
        });

        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: { increment: bet.amount } },
        });
      }

      this.logger.log(
        `Refunded ${pendingBets.length} bets for cancelled event ${eventId}`,
      );
    });
  }
}
