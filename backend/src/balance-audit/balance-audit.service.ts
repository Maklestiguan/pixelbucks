import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { PrismaService } from '../prisma';
import {
  RABBITMQ_CHANNEL,
  EXCHANGES,
  ROUTING_KEYS,
} from '../rabbitmq/rabbitmq.module';

export type AuditReason =
  | 'bet_placed'
  | 'bet_won'
  | 'bet_refund'
  | 'admin_adjust'
  | 'replenish'
  | 'challenge_reward';

interface AuditEntry {
  userId: string;
  amount: number; // positive = credit, negative = debit
  reason: AuditReason;
  referenceId?: string;
  note?: string;
}

@Injectable()
export class BalanceAuditService {
  private readonly logger = new Logger(BalanceAuditService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(RABBITMQ_CHANNEL) private channel: ChannelWrapper,
  ) {}

  /**
   * Publish a balance audit message. The actual DB write + socket push
   * happens asynchronously in BalanceAuditConsumer.
   */
  async log(entry: AuditEntry) {
    try {
      await this.channel.publish(
        EXCHANGES.USERS,
        ROUTING_KEYS.BALANCE_AUDIT,
        entry,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to publish balance audit: ${msg}`);
    }
  }

  /** Get audit log for a specific user (paginated, desc sorted) */
  async getUserAuditLog(userId: string, page = 1, limit = 100) {
    const [data, total] = await Promise.all([
      this.prisma.balanceAudit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.balanceAudit.count({ where: { userId } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Get audit log for all users — admin only (paginated, desc sorted) */
  async getAllAuditLog(params: {
    page?: number;
    limit?: number;
    userId?: string;
    reason?: string;
  }) {
    const { page = 1, limit = 100, userId, reason } = params;
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (reason) where.reason = reason;

    const [rows, total] = await Promise.all([
      this.prisma.balanceAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true } },
        },
      }),
      this.prisma.balanceAudit.count({ where }),
    ]);

    // Collect referenceIds by type for batch lookup
    const betReasons = ['bet_placed', 'bet_won', 'bet_refund'];
    const betIds = rows
      .filter((r) => betReasons.includes(r.reason) && r.referenceId)
      .map((r) => r.referenceId!);
    const challengeIds = rows
      .filter((r) => r.reason === 'challenge_reward' && r.referenceId)
      .map((r) => r.referenceId!);

    const betSelect = {
      id: true,
      amount: true,
      selection: true,
      oddsAtPlacement: true,
      status: true,
      payout: true,
      event: {
        select: { id: true, teamA: true, teamB: true, game: true },
      },
    } as const;

    const challengeSelect = {
      id: true,
      title: true,
      type: true,
      reward: true,
    } as const;

    const bets =
      betIds.length > 0
        ? await this.prisma.bet.findMany({
            where: { id: { in: betIds } },
            select: betSelect,
          })
        : [];

    const challenges =
      challengeIds.length > 0
        ? await this.prisma.challenge.findMany({
            where: { id: { in: challengeIds } },
            select: challengeSelect,
          })
        : [];

    type BetRef = (typeof bets)[number];
    type ChallengeRef = (typeof challenges)[number];

    const betMap = new Map<string, BetRef>(bets.map((b) => [b.id, b]));
    const challengeMap = new Map<string, ChallengeRef>(
      challenges.map((c) => [c.id, c]),
    );

    const data = rows.map((row) => {
      let reference: Record<string, unknown> | null = null;

      if (row.referenceId && betReasons.includes(row.reason)) {
        const bet = betMap.get(row.referenceId);
        if (bet) reference = { refType: 'bet', ...bet };
      } else if (row.referenceId && row.reason === 'challenge_reward') {
        const challenge = challengeMap.get(row.referenceId);
        if (challenge) reference = { refType: 'challenge', ...challenge };
      }

      return { ...row, reference };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
