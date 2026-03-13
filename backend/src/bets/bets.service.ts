import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { PlaceBetDto } from './dto';

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(private prisma: PrismaService) {}

  async placeBet(userId: string, dto: PlaceBetDto) {
    if (!['a', 'b'].includes(dto.selection)) {
      throw new BadRequestException('Selection must be "a" or "b"');
    }

    return this.prisma.$transaction(async (tx) => {
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

      // Check user balance
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.balance < dto.amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Snapshot odds
      const odds = dto.selection === 'a' ? event.oddsA : event.oddsB;
      if (!odds) {
        throw new BadRequestException('Odds not available for this selection');
      }

      // Deduct balance and create bet
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: dto.amount } },
      });

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
        potentialPayout: Math.floor(bet.amount * bet.oddsAtPlacement),
      };
    });
  }

  async getMyBets(
    userId: string,
    params: { status?: string; page?: number; limit?: number },
  ) {
    const { status, page = 1, limit = 20 } = params;
    const where: any = { userId };
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
    return this.prisma.$transaction(async (tx) => {
      const pendingBets = await tx.bet.findMany({
        where: { eventId, status: 'PENDING' },
      });

      for (const bet of pendingBets) {
        const won = bet.selection === winnerId;
        const payout = won ? Math.floor(bet.amount * bet.oddsAtPlacement) : 0;
        // profit = payout - amount for wins, -amount for losses
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
    });
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
