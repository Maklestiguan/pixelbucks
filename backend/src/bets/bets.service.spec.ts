import { Test, TestingModule } from '@nestjs/testing';
import { BetsService } from './bets.service';
import { PrismaService } from '../prisma';
import { BalanceAuditService } from '../balance-audit';
import { SettingsService } from '../settings';
import { RABBITMQ_CHANNEL } from '../rabbitmq/rabbitmq.module';

describe('BetsService', () => {
  let service: BetsService;
  let prisma: {
    bet: { findMany: jest.Mock; updateMany: jest.Mock };
    user: { update: jest.Mock };
  };
  let channel: { publish: jest.Mock };
  let balanceAudit: { log: jest.Mock };
  let settings: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      bet: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    };
    channel = { publish: jest.fn().mockResolvedValue(undefined) };
    balanceAudit = { log: jest.fn().mockResolvedValue(undefined) };
    settings = {
      get: jest.fn().mockResolvedValue({ cs2AllowBetsWithoutHltv: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BalanceAuditService, useValue: balanceAudit },
        { provide: SettingsService, useValue: settings },
        { provide: RABBITMQ_CHANNEL, useValue: channel },
      ],
    }).compile();

    service = module.get<BetsService>(BetsService);
  });

  describe('resolveEventBets', () => {
    it('should bulk update losing bets and publish winning bets to queue', async () => {
      const eventId = 'event-1';
      const winnerId = 'a';

      prisma.bet.findMany.mockResolvedValue([
        {
          id: 'bet-1',
          userId: 'user-1',
          eventId,
          selection: 'a',
          amount: 1000,
          oddsAtPlacement: 2.5,
          status: 'PENDING',
        },
        {
          id: 'bet-2',
          userId: 'user-2',
          eventId,
          selection: 'b',
          amount: 500,
          oddsAtPlacement: 1.5,
          status: 'PENDING',
        },
        {
          id: 'bet-3',
          userId: 'user-1',
          eventId,
          selection: 'b',
          amount: 300,
          oddsAtPlacement: 1.8,
          status: 'PENDING',
        },
      ]);

      prisma.bet.updateMany.mockResolvedValue({ count: 2 });

      await service.resolveEventBets(eventId, winnerId);

      // Bulk update losers
      expect(prisma.bet.updateMany).toHaveBeenCalledWith({
        where: { eventId, status: 'PENDING', selection: { not: 'a' } },
        data: { status: 'LOST', payout: 0 },
      });

      // totalProfit updates are now handled by BetUpdateConsumer, not here
      expect(prisma.user.update).not.toHaveBeenCalled();

      // Per-bet messages: 2 lost + 1 won = 3 publishes
      expect(channel.publish).toHaveBeenCalledTimes(3);

      // Losing bets
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-2',
        userId: 'user-2',
        action: 'lost',
        amount: 500,
        payout: 0,
        oddsAtPlacement: 1.5,
      });
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-3',
        userId: 'user-1',
        action: 'lost',
        amount: 300,
        payout: 0,
        oddsAtPlacement: 1.8,
      });

      // Winning bet
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-1',
        userId: 'user-1',
        action: 'won',
        amount: 1000,
        payout: 2500, // floor(1000 * 2.5)
        oddsAtPlacement: 2.5,
      });
    });

    it('should handle no pending bets', async () => {
      prisma.bet.findMany.mockResolvedValue([]);

      await service.resolveEventBets('event-1', 'a');

      expect(prisma.bet.updateMany).not.toHaveBeenCalled();
      expect(channel.publish).not.toHaveBeenCalled();
    });

    it('should handle all bets losing', async () => {
      prisma.bet.findMany.mockResolvedValue([
        {
          id: 'bet-1',
          userId: 'user-1',
          eventId: 'event-1',
          selection: 'b',
          amount: 1000,
          oddsAtPlacement: 1.5,
          status: 'PENDING',
        },
      ]);
      prisma.bet.updateMany.mockResolvedValue({ count: 1 });

      await service.resolveEventBets('event-1', 'a');

      expect(prisma.bet.updateMany).toHaveBeenCalled();
      // One lost message published, no winners
      expect(channel.publish).toHaveBeenCalledTimes(1);
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-1',
        userId: 'user-1',
        action: 'lost',
        amount: 1000,
        payout: 0,
        oddsAtPlacement: 1.5,
      });
    });

    it('should publish a lost message per losing bet (no in-service grouping)', async () => {
      prisma.bet.findMany.mockResolvedValue([
        {
          id: 'bet-1',
          userId: 'user-1',
          selection: 'b',
          amount: 200,
          oddsAtPlacement: 1.5,
          status: 'PENDING',
        },
        {
          id: 'bet-2',
          userId: 'user-1',
          selection: 'b',
          amount: 300,
          oddsAtPlacement: 1.8,
          status: 'PENDING',
        },
      ]);
      prisma.bet.updateMany.mockResolvedValue({ count: 2 });

      await service.resolveEventBets('event-1', 'a');

      // totalProfit aggregation now happens in BetUpdateConsumer (per-user
      // Redis lock there), not in BetsService.
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(channel.publish).toHaveBeenCalledTimes(2);
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-1',
        userId: 'user-1',
        action: 'lost',
        amount: 200,
        payout: 0,
        oddsAtPlacement: 1.5,
      });
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-2',
        userId: 'user-1',
        action: 'lost',
        amount: 300,
        payout: 0,
        oddsAtPlacement: 1.8,
      });
    });
  });

  describe('refundEventBets', () => {
    it('should publish refund messages for all pending bets', async () => {
      prisma.bet.findMany.mockResolvedValue([
        {
          id: 'bet-1',
          userId: 'user-1',
          amount: 1000,
          oddsAtPlacement: 2.0,
          status: 'PENDING',
        },
        {
          id: 'bet-2',
          userId: 'user-2',
          amount: 500,
          oddsAtPlacement: 1.5,
          status: 'PENDING',
        },
      ]);

      await service.refundEventBets('event-1');

      expect(channel.publish).toHaveBeenCalledTimes(2);
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-1',
        userId: 'user-1',
        action: 'refund',
        amount: 1000,
        payout: 0,
        oddsAtPlacement: 2.0,
      });
      expect(channel.publish).toHaveBeenCalledWith('events', 'bet.update', {
        betId: 'bet-2',
        userId: 'user-2',
        action: 'refund',
        amount: 500,
        payout: 0,
        oddsAtPlacement: 1.5,
      });
    });

    it('should handle no pending bets', async () => {
      prisma.bet.findMany.mockResolvedValue([]);

      await service.refundEventBets('event-1');

      expect(channel.publish).not.toHaveBeenCalled();
    });
  });
});
