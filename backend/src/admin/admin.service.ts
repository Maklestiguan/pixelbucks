import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { EventsService } from '../events/events.service';
import { UpdateEventDto, AdjustBalanceDto } from './dto';
import type { MatchStatus, Prisma } from '@prisma/client';

const VALID_STATUSES: MatchStatus[] = [
  'UPCOMING',
  'LIVE',
  'FINISHED',
  'CANCELLED',
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

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

  private formatBalance(cents: number): string {
    return (cents / 100).toFixed(2);
  }
}
