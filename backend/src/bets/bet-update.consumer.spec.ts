import { BetUpdateConsumer } from './bet-update.consumer';

describe('BetUpdateConsumer', () => {
  let consumer: BetUpdateConsumer;
  let prisma: {
    bet: { update: jest.Mock };
    user: { update: jest.Mock };
  };
  let channel: { publish: jest.Mock };
  let balanceAudit: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      bet: { update: jest.fn().mockResolvedValue({}) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    channel = { publish: jest.fn().mockResolvedValue(undefined) };
    balanceAudit = { log: jest.fn().mockResolvedValue(undefined) };

    consumer = Object.create(BetUpdateConsumer.prototype);
    (consumer as any).prisma = prisma;
    (consumer as any).channel = channel;
    (consumer as any).balanceAudit = balanceAudit;
    (consumer as any).logger = { debug: jest.fn(), log: jest.fn() };
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

      expect(prisma.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-1' },
        data: { status: 'WON', payout: 2500 },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          balance: { increment: 2500 },
          totalProfit: { increment: 1500 },
        },
      });

      // Challenge tracking published via RabbitMQ
      expect(channel.publish).toHaveBeenCalledWith(
        'users',
        'challenge.progress',
        { userId: 'user-1', action: 'win_bet' },
      );
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

      expect(prisma.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-2' },
        data: { status: 'CANCELLED', payout: 0 },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { balance: { increment: 500 } },
      });

      // No challenge progress for refunds
      expect(channel.publish).not.toHaveBeenCalled();
    });
  });
});
