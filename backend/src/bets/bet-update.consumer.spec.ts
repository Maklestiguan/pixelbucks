import { BetUpdateConsumer } from './bet-update.consumer';

describe('BetUpdateConsumer', () => {
  let consumer: BetUpdateConsumer;
  let prisma: {
    bet: { updateMany: jest.Mock };
    user: { update: jest.Mock };
  };
  let channel: { publish: jest.Mock };
  let balanceAudit: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      bet: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    channel = { publish: jest.fn().mockResolvedValue(undefined) };
    balanceAudit = { log: jest.fn().mockResolvedValue(undefined) };

    consumer = Object.create(BetUpdateConsumer.prototype);
    (consumer as any).prisma = prisma;
    (consumer as any).channel = channel;
    (consumer as any).balanceAudit = balanceAudit;
    (consumer as any).logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
  });

  describe('processBetUpdate (won)', () => {
    it('should update bet to WON, credit user, and publish challenge progress', async () => {
      await (consumer as any).processBetUpdate({
        betId: 'bet-1',
        userId: 'user-1',
        action: 'won',
        amount: 1000,
        payout: 2500,
        oddsAtPlacement: 2.5,
      });

      expect(prisma.bet.updateMany).toHaveBeenCalledWith({
        where: { id: 'bet-1', balanceAppliedAt: null },
        data: {
          status: 'WON',
          payout: 2500,
          balanceAppliedAt: expect.any(Date),
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          balance: { increment: 2500 },
          totalProfit: { increment: 1500 },
        },
      });

      expect(channel.publish).toHaveBeenCalledWith(
        'users',
        'challenge.progress',
        { userId: 'user-1', action: 'win_bet' },
      );
    });

    it('should skip balance credit when bet is already applied', async () => {
      prisma.bet.updateMany.mockResolvedValueOnce({ count: 0 });

      await (consumer as any).processBetUpdate({
        betId: 'bet-1',
        userId: 'user-1',
        action: 'won',
        amount: 1000,
        payout: 2500,
        oddsAtPlacement: 2.5,
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(channel.publish).not.toHaveBeenCalled();
    });
  });

  describe('processBetUpdate (lost)', () => {
    it('should mark bet applied and decrement totalProfit', async () => {
      await (consumer as any).processBetUpdate({
        betId: 'bet-3',
        userId: 'user-3',
        action: 'lost',
        amount: 400,
        payout: 0,
        oddsAtPlacement: 1.8,
      });

      expect(prisma.bet.updateMany).toHaveBeenCalledWith({
        where: { id: 'bet-3', balanceAppliedAt: null },
        data: { balanceAppliedAt: expect.any(Date) },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-3' },
        data: { totalProfit: { decrement: 400 } },
      });
    });

    it('should skip profit decrement when bet is already applied', async () => {
      prisma.bet.updateMany.mockResolvedValueOnce({ count: 0 });

      await (consumer as any).processBetUpdate({
        betId: 'bet-3',
        userId: 'user-3',
        action: 'lost',
        amount: 400,
        payout: 0,
        oddsAtPlacement: 1.8,
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('processBetUpdate (refund)', () => {
    it('should update bet to CANCELLED and refund user balance', async () => {
      await (consumer as any).processBetUpdate({
        betId: 'bet-2',
        userId: 'user-2',
        action: 'refund',
        amount: 500,
        payout: 0,
        oddsAtPlacement: 1.5,
      });

      expect(prisma.bet.updateMany).toHaveBeenCalledWith({
        where: { id: 'bet-2', balanceAppliedAt: null },
        data: {
          status: 'CANCELLED',
          payout: 0,
          balanceAppliedAt: expect.any(Date),
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { balance: { increment: 500 } },
      });

      expect(channel.publish).not.toHaveBeenCalled();
    });

    it('should skip refund when bet is already applied', async () => {
      prisma.bet.updateMany.mockResolvedValueOnce({ count: 0 });

      await (consumer as any).processBetUpdate({
        betId: 'bet-2',
        userId: 'user-2',
        action: 'refund',
        amount: 500,
        payout: 0,
        oddsAtPlacement: 1.5,
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
