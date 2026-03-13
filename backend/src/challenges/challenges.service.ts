import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { ChallengeType } from '@prisma/client';

interface ChallengeTemplate {
  type: ChallengeType;
  title: string;
  description: string;
  reward: number; // cents
  criteria: { action: string; count: number };
}

const DAILY_TEMPLATES: ChallengeTemplate[] = [
  {
    type: 'DAILY',
    title: 'Place 3 Bets',
    description: 'Place 3 bets on any events today',
    reward: 5000, // 50 PB
    criteria: { action: 'place_bet', count: 3 },
  },
  {
    type: 'DAILY',
    title: 'Bet on 2 Different Games',
    description: 'Place bets on both Dota 2 and CS2 events',
    reward: 7500, // 75 PB
    criteria: { action: 'bet_different_games', count: 2 },
  },
  {
    type: 'DAILY',
    title: 'Win a Bet',
    description: 'Win at least 1 bet today',
    reward: 10000, // 100 PB
    criteria: { action: 'win_bet', count: 1 },
  },
];

const WEEKLY_TEMPLATES: ChallengeTemplate[] = [
  {
    type: 'WEEKLY',
    title: 'Place 10 Bets',
    description: 'Place 10 bets this week',
    reward: 15000, // 150 PB
    criteria: { action: 'place_bet', count: 10 },
  },
  {
    type: 'WEEKLY',
    title: 'Win 5 Bets',
    description: 'Win 5 bets this week',
    reward: 25000, // 250 PB
    criteria: { action: 'win_bet', count: 5 },
  },
  {
    type: 'WEEKLY',
    title: 'Wager 500 PB Total',
    description: 'Wager a total of 500 PB this week',
    reward: 20000, // 200 PB
    criteria: { action: 'total_wagered', count: 50000 }, // 500 PB in cents
  },
];

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(private prisma: PrismaService) {}

  /** Get active challenges for a user, auto-enrolling if not yet enrolled */
  async getActiveChallenges(userId: string) {
    const now = new Date();

    const challenges = await this.prisma.challenge.findMany({
      where: { expiresAt: { gt: now }, startsAt: { lte: now } },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });

    // Auto-enroll user in challenges they haven't joined yet
    const userChallenges = await this.prisma.userChallenge.findMany({
      where: {
        userId,
        challengeId: { in: challenges.map((c) => c.id) },
      },
    });

    const enrolledIds = new Set(userChallenges.map((uc) => uc.challengeId));
    const toEnroll = challenges.filter((c) => !enrolledIds.has(c.id));

    if (toEnroll.length > 0) {
      await this.prisma.userChallenge.createMany({
        data: toEnroll.map((c) => ({
          userId,
          challengeId: c.id,
        })),
        skipDuplicates: true,
      });
    }

    // Refetch with enrollment data
    const allUserChallenges = await this.prisma.userChallenge.findMany({
      where: {
        userId,
        challengeId: { in: challenges.map((c) => c.id) },
      },
      include: { challenge: true },
    });

    return allUserChallenges.map((uc) => ({
      id: uc.id,
      challengeId: uc.challengeId,
      type: uc.challenge.type,
      title: uc.challenge.title,
      description: uc.challenge.description,
      reward: uc.challenge.reward,
      criteria: uc.challenge.criteria,
      progress: uc.progress,
      status: uc.status,
      completedAt: uc.completedAt,
      expiresAt: uc.challenge.expiresAt,
    }));
  }

  /** Increment progress on challenges matching an action for a user */
  async trackProgress(
    userId: string,
    action: string,
    increment = 1,
  ) {
    const now = new Date();

    // Find active user challenges matching the action
    const userChallenges = await this.prisma.userChallenge.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        challenge: {
          expiresAt: { gt: now },
          startsAt: { lte: now },
        },
      },
      include: { challenge: true },
    });

    for (const uc of userChallenges) {
      const criteria = uc.challenge.criteria as { action: string; count: number };
      if (criteria.action !== action) continue;

      const newProgress = uc.progress + increment;
      const completed = newProgress >= criteria.count;

      await this.prisma.userChallenge.update({
        where: { id: uc.id },
        data: {
          progress: newProgress,
          ...(completed
            ? { status: 'COMPLETED', completedAt: new Date() }
            : {}),
        },
      });

      if (completed) {
        // Credit reward
        await this.prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: uc.challenge.reward } },
        });
        this.logger.log(
          `User ${userId} completed challenge "${uc.challenge.title}", rewarded ${uc.challenge.reward / 100} PB`,
        );
      }
    }
  }

  /** Create daily/weekly challenges if none exist for current period */
  async generateChallenges() {
    const now = new Date();
    let created = 0;

    // Daily challenge: check if there's one expiring today
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const existingDaily = await this.prisma.challenge.findFirst({
      where: { type: 'DAILY', expiresAt: { gt: now } },
    });

    if (!existingDaily) {
      const template =
        DAILY_TEMPLATES[Math.floor(Math.random() * DAILY_TEMPLATES.length)];
      const startsAt = new Date(now);
      startsAt.setHours(0, 0, 0, 0);

      await this.prisma.challenge.create({
        data: {
          type: template.type,
          title: template.title,
          description: template.description,
          reward: template.reward,
          criteria: template.criteria,
          startsAt,
          expiresAt: todayEnd,
        },
      });
      created++;
    }

    // Weekly challenge: check if there's one expiring this week
    const existingWeekly = await this.prisma.challenge.findFirst({
      where: { type: 'WEEKLY', expiresAt: { gt: now } },
    });

    if (!existingWeekly) {
      const template =
        WEEKLY_TEMPLATES[
          Math.floor(Math.random() * WEEKLY_TEMPLATES.length)
        ];
      const startsAt = new Date(now);
      startsAt.setHours(0, 0, 0, 0);
      const weekEnd = new Date(startsAt);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);

      await this.prisma.challenge.create({
        data: {
          type: template.type,
          title: template.title,
          description: template.description,
          reward: template.reward,
          criteria: template.criteria,
          startsAt,
          expiresAt: weekEnd,
        },
      });
      created++;
    }

    if (created > 0) {
      this.logger.log(`Generated ${created} new challenges`);
    }
    return { created };
  }

  /** Mark expired user challenges as EXPIRED */
  async expireChallenges() {
    const now = new Date();
    const result = await this.prisma.userChallenge.updateMany({
      where: {
        status: 'ACTIVE',
        challenge: { expiresAt: { lt: now } },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} user challenges`);
    }
    return { expired: result.count };
  }
}
