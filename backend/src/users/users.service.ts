import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma';
import { UpdateProfileDto } from './dto';

const LEADERBOARD_TTL = 60 * 1000; // 60s

const REPLENISH_AMOUNT = 50000; // 500.00 PB in cents
const REPLENISH_INTERVAL_DAYS = 7;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        balance: true,
        totalProfit: true,
        statsPublic: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      balance: this.formatBalance(user.balance),
      totalProfit: this.formatBalance(user.totalProfit),
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        username: true,
        role: true,
        balance: true,
        totalProfit: true,
        statsPublic: true,
        createdAt: true,
      },
    });

    return {
      ...user,
      balance: this.formatBalance(user.balance),
      totalProfit: this.formatBalance(user.totalProfit),
    };
  }

  async getStats(
    targetUserId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        statsPublic: true,
        totalProfit: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (
      !targetUser.statsPublic &&
      targetUserId !== requesterId &&
      requesterRole !== 'ADMIN'
    ) {
      throw new ForbiddenException('User stats are private');
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const bets = await this.prisma.bet.findMany({
      where: {
        userId: targetUserId,
        createdAt: { gte: ninetyDaysAgo },
        status: { in: ['WON', 'LOST'] },
      },
      select: {
        amount: true,
        payout: true,
        status: true,
      },
    });

    const totalBets = bets.length;
    const wins = bets.filter((b) => b.status === 'WON').length;
    const winPercent = totalBets > 0 ? (wins / totalBets) * 100 : 0;
    const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);
    const totalReturned = bets.reduce((sum, b) => sum + (b.payout || 0), 0);
    const roiNet = totalReturned - totalWagered;
    const roiPercent = totalWagered > 0 ? (roiNet / totalWagered) * 100 : 0;

    return {
      userId: targetUser.id,
      username: targetUser.username,
      totalBets,
      wins,
      winPercent: Math.round(winPercent * 100) / 100,
      roiNet: this.formatBalance(roiNet),
      roiPercent: Math.round(roiPercent * 100) / 100,
      totalProfit: this.formatBalance(targetUser.totalProfit),
    };
  }

  /** Find users eligible for weekly 500 PB top-up and return their IDs */
  async findReplenishableUsers(): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REPLENISH_INTERVAL_DAYS);

    const users = await this.prisma.user.findMany({
      where: { lastReplenishedAt: { lt: cutoff } },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  /** Credit 500 PB to a single user and update lastReplenishedAt */
  async replenishUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        balance: { increment: REPLENISH_AMOUNT },
        lastReplenishedAt: new Date(),
      },
    });
    this.logger.log(
      `Replenished user ${userId} with ${REPLENISH_AMOUNT / 100} PB`,
    );
  }

  /** Leaderboard: top users by totalProfit (public stats only) */
  async getLeaderboard(limit = 20) {
    const cacheKey = `users:leaderboard:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: { statsPublic: true },
      orderBy: { totalProfit: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        totalProfit: true,
        _count: { select: { bets: true } },
      },
    });

    const result = users.map((u) => ({
      id: u.id,
      username: u.username,
      totalProfit: this.formatBalance(u.totalProfit),
      totalBets: u._count.bets,
    }));
    await this.cache.set(cacheKey, result, LEADERBOARD_TTL);
    return result;
  }

  private formatBalance(cents: number): string {
    return (cents / 100).toFixed(2);
  }
}
