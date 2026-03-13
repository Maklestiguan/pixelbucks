import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  private formatBalance(cents: number): string {
    return (cents / 100).toFixed(2);
  }
}
