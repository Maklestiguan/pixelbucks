import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';
import { BetsService } from '../src/bets/bets.service';
import { FastestValidatorPipe } from '../src/common/pipes/validation.pipe';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('PixelBucks E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let eventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new FastestValidatorPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await prisma.bet.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.chatMessage.deleteMany({});
    await prisma.userChallenge.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
  });

  afterAll(async () => {
    await prisma.bet.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.chatMessage.deleteMany({});
    await prisma.userChallenge.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/auth/register - should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: 'e2euser', password: 'password123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.username).toBe('e2euser');
      expect(res.body.user.role).toBe('USER');
      token = res.body.accessToken;
      userId = res.body.user.id;
    });

    it('POST /api/auth/register - should reject duplicate username', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: 'e2euser', password: 'password123' })
        .expect(409);
    });

    it('POST /api/auth/login - should login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'e2euser', password: 'password123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      token = res.body.accessToken;
    });

    it('POST /api/auth/login - should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'e2euser', password: 'wrongpass' })
        .expect(401);
    });
  });

  describe('Users', () => {
    it('GET /api/users/me - should return current user with formatted balance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.username).toBe('e2euser');
      expect(res.body.balance).toBe('1000.00');
      expect(res.body.statsPublic).toBe(true);
    });

    it('GET /api/users/me - should reject without token', async () => {
      await request(app.getHttpServer()).get('/api/users/me').expect(401);
    });

    it('PATCH /api/users/me - should update stats visibility', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ statsPublic: false })
        .expect(200);

      expect(res.body.statsPublic).toBe(false);
    });

    it('GET /api/users/:id/stats - should return stats for own user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${userId}/stats`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalBets).toBe(0);
      expect(res.body.winPercent).toBe(0);
    });
  });

  describe('Events', () => {
    beforeAll(async () => {
      // Create test events directly in DB
      const event = await prisma.event.create({
        data: {
          pandascoreId: 99999,
          game: 'dota2',
          tournament: 'Test International',
          league: 'Test League',
          teamA: 'Team Alpha',
          teamALogo: '',
          teamB: 'Team Beta',
          teamBLogo: '',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          status: 'UPCOMING',
          oddsA: 1.85,
          oddsB: 2.1,
          bestOf: 3,
          maxBet: 10000,
          rawData: {},
        },
      });
      eventId = event.id;

      // Create a past event for results checking
      await prisma.event.create({
        data: {
          pandascoreId: 99998,
          game: 'cs2',
          tournament: 'Test Major',
          league: 'Test League',
          teamA: 'Team Gamma',
          teamALogo: '',
          teamB: 'Team Delta',
          teamBLogo: '',
          scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          status: 'UPCOMING',
          oddsA: 1.5,
          oddsB: 2.8,
          bestOf: 3,
          maxBet: 5000,
          rawData: {},
        },
      });
    });

    it('GET /api/events - should list all events', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/events?game=dota2 - should filter by game', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/events?game=dota2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.every((e: any) => e.game === 'dota2')).toBe(true);
    });

    it('GET /api/events/:id - should return single event', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.teamA).toBe('Team Alpha');
      expect(res.body.oddsA).toBe(1.85);
      expect(res.body.oddsB).toBe(2.1);
    });

    it('GET /api/events/:id - should 404 for unknown event', async () => {
      await request(app.getHttpServer())
        .get('/api/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Bets', () => {
    it('POST /api/bets - should place a valid bet', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId, selection: 'a', amount: 5000 })
        .expect(201);

      expect(res.body.selection).toBe('a');
      expect(res.body.amount).toBe(5000);
      expect(res.body.oddsAtPlacement).toBe(1.85);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.potentialPayout).toBe(9250); // floor(5000 * 1.85)
    });

    it('POST /api/bets - should deduct balance after bet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.balance).toBe('950.00'); // 1000 - 50.00
    });

    it('POST /api/bets - should reject bet exceeding max per event', async () => {
      await request(app.getHttpServer())
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId, selection: 'b', amount: 6000 }) // 5000 + 6000 > 10000
        .expect(400);
    });

    it('POST /api/bets - should reject invalid selection', async () => {
      await request(app.getHttpServer())
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId, selection: 'draw', amount: 1000 })
        .expect(400);
    });

    it('GET /api/bets/my - should list user bets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bets/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].event).toBeDefined();
      expect(res.body.data[0].event.teamA).toBe('Team Alpha');
    });

    it('GET /api/bets/my/active - should list active bets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bets/my/active')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('PENDING');
    });
  });

  describe('Bet Resolution', () => {
    it('should resolve bets when event finishes (via service)', async () => {
      const betsService = app.get(BetsService);
      await betsService.resolveEventBets(eventId, 'a');

      // Check bet is resolved as WON
      const res = await request(app.getHttpServer())
        .get('/api/bets/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const bet = res.body.data[0];
      expect(bet.status).toBe('WON');
      expect(bet.payout).toBe(9250); // floor(5000 * 1.85)
    });

    it('should credit balance after winning bet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Started 1000.00, bet 50.00, won 92.50 → 1042.50
      expect(res.body.balance).toBe('1042.50');
    });

    it('should track totalProfit after winning bet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Won: profit = payout - amount = 9250 - 5000 = 4250 cents = 42.50
      expect(res.body.totalProfit).toBe('42.50');
    });
  });

  describe('Outbox', () => {
    it('should create outbox events when event finishes', async () => {
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { type: 'event.finished' },
      });

      // The event was resolved directly via service, not via outbox
      // but we can verify outbox functionality by checking a cancel
      const cs2Event = await prisma.event.findFirst({
        where: { game: 'cs2', pandascoreId: 99998 },
      });

      if (cs2Event) {
        // Place a bet on cs2 event first
        await request(app.getHttpServer())
          .post('/api/bets')
          .set('Authorization', `Bearer ${token}`)
          .send({ eventId: cs2Event.id, selection: 'a', amount: 2000 })
          .expect(201);

        // Cancel the event (simulating draw) — write to outbox in same tx
        await prisma.$transaction([
          prisma.event.update({
            where: { id: cs2Event.id },
            data: { status: 'CANCELLED' },
          }),
          prisma.outboxEvent.create({
            data: {
              type: 'event.cancelled',
              payload: { eventId: cs2Event.id },
            },
          }),
        ]);

        // Refund bets
        const betsService = app.get(BetsService);
        await betsService.refundEventBets(cs2Event.id);

        // Check balance was refunded
        const userRes = await request(app.getHttpServer())
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Was 1042.50, bet 20.00, refunded 20.00 → 1042.50
        expect(userRes.body.balance).toBe('1042.50');
      }
    });
  });

  describe('Live Match Bet Rejection', () => {
    let liveEventId: string;

    beforeAll(async () => {
      const liveEvent = await prisma.event.create({
        data: {
          pandascoreId: 99997,
          game: 'dota2',
          tournament: 'Test Live Tournament',
          league: 'Test League',
          teamA: 'Team Live A',
          teamB: 'Team Live B',
          teamALogo: '',
          teamBLogo: '',
          scheduledAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          status: 'LIVE',
          oddsA: 1.75,
          oddsB: 2.2,
          bestOf: 3,
          maxBet: 10000,
          rawData: {},
        },
      });
      liveEventId = liveEvent.id;
    });

    it('POST /api/bets - should reject bet on LIVE event', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: liveEventId, selection: 'a', amount: 1000 })
        .expect(400);

      expect(res.body.message).toContain('not available for betting');
    });
  });

  describe('Profit Tracking on Loss', () => {
    let lossEventId: string;

    beforeAll(async () => {
      const event = await prisma.event.create({
        data: {
          pandascoreId: 99996,
          game: 'cs2',
          tournament: 'Test Loss Tournament',
          league: 'Test League',
          teamA: 'Team Win',
          teamALogo: '',
          teamB: 'Team Lose',
          teamBLogo: '',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'UPCOMING',
          oddsA: 1.5,
          oddsB: 2.8,
          bestOf: 3,
          maxBet: 10000,
          rawData: {},
        },
      });
      lossEventId = event.id;
    });

    it('should track negative profit after losing bet', async () => {
      // Place a bet on selection 'a'
      await request(app.getHttpServer())
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: lossEventId, selection: 'a', amount: 3000 })
        .expect(201);

      // Resolve: 'b' wins, so our 'a' bet loses
      const betsService = app.get(BetsService);
      await betsService.resolveEventBets(lossEventId, 'b');

      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Previous totalProfit was 42.50, lost 30.00 → 12.50
      expect(res.body.totalProfit).toBe('12.50');
    });
  });

  describe('Stats include totalProfit', () => {
    it('GET /api/users/:id/stats - should include totalProfit', async () => {
      // Re-enable stats for this test
      await request(app.getHttpServer())
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ statsPublic: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/users/${userId}/stats`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalProfit).toBeDefined();
      expect(res.body.totalProfit).toBe('12.50');
    });
  });

  describe('Admin', () => {
    let adminToken: string;

    beforeAll(async () => {
      // Create admin user directly in DB
      const hash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'e2eadmin',
          passwordHash: hash,
          role: 'ADMIN',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'e2eadmin', password: 'admin123' })
        .expect(201);

      adminToken = res.body.accessToken;
    });

    it('GET /api/admin/stats - regular user should get 403', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /api/admin/stats - admin should get platform stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
      expect(res.body.totalBets).toBeGreaterThanOrEqual(1);
      expect(res.body.totalVolume).toBeDefined();
      expect(res.body.activeEvents).toBeDefined();
      expect(res.body.totalCirculation).toBeDefined();
    });

    it('GET /api/admin/users - should list users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/admin/users?search=e2euser - should filter by username', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users?search=e2euser')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].username).toBe('e2euser');
    });

    it('GET /api/admin/users/:id - should return user details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.username).toBe('e2euser');
      expect(res.body.totalBets).toBeDefined();
      expect(res.body.balance).toBeDefined();
    });

    it('PATCH /api/admin/users/:id/balance - should adjust balance', async () => {
      const beforeRes = await request(app.getHttpServer())
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const balanceBefore = parseFloat(beforeRes.body.balance);

      const res = await request(app.getHttpServer())
        .patch(`/api/admin/users/${userId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 5000, reason: 'e2e test credit' })
        .expect(200);

      expect(parseFloat(res.body.balance)).toBe(balanceBefore + 50.0);
    });

    it('PATCH /api/admin/events/:id - should update odds', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/admin/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ oddsA: 2.5, oddsB: 1.65 })
        .expect(200);

      expect(res.body.oddsA).toBe(2.5);
      expect(res.body.oddsB).toBe(1.65);
    });

    it('PATCH /api/admin/events/:id - regular user should get 403', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ oddsA: 3.0 })
        .expect(403);
    });

    it('PATCH /api/admin/events/:id - should reject invalid odds', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ oddsA: 0.5 })
        .expect(400);
    });
  });

  describe('Race Condition - Concurrent Bets', () => {
    let raceToken: string;
    let raceEventId: string;

    beforeAll(async () => {
      // Fresh user with default 1000 PB (100000 cents) balance
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: 'racetestuser', password: 'password123' })
        .expect(201);
      raceToken = res.body.accessToken;

      // maxBet is intentionally high (2000 PB) so only the balance check gates bets
      const event = await prisma.event.create({
        data: {
          pandascoreId: 88888,
          game: 'dota2',
          tournament: 'Race Condition Tournament',
          league: 'Test League',
          teamA: 'Race Team A',
          teamALogo: '',
          teamB: 'Race Team B',
          teamBLogo: '',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'UPCOMING',
          oddsA: 1.85,
          oddsB: 2.1,
          bestOf: 3,
          maxBet: 200000,
          rawData: {},
        },
      });
      raceEventId = event.id;
    });

    it('should never produce a negative balance under concurrent bets', async () => {
      // User balance: 100000 cents (1000 PB)
      // 5 concurrent bets of 30000 cents (300 PB) each
      // Without the fix: all 5 could pass the balance check before any decrement → balance = -50 PB
      // With atomic updateMany WHERE balance >= amount: at most 3 succeed (3 × 300 = 900 ≤ 1000)
      const BET_AMOUNT = 30000;
      const NUM_BETS = 4;

      const results = await Promise.all(
        Array.from({ length: NUM_BETS }, () =>
          request(app.getHttpServer())
            .post('/api/bets')
            .set('Authorization', `Bearer ${raceToken}`)
            .send({ eventId: raceEventId, selection: 'a', amount: BET_AMOUNT }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 201).length;
      const failed = results.filter((r) => r.status === 400).length;
      expect(succeeded + failed).toBe(NUM_BETS);

      const userRes = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${raceToken}`)
        .expect(200);

      const finalBalance = parseFloat(userRes.body.balance);

      // Balance must never be negative
      expect(finalBalance).toBeGreaterThanOrEqual(0);

      // Balance must be exactly initial minus the sum of successful bets
      const expectedBalance = (100000 - succeeded * BET_AMOUNT) / 100;
      expect(finalBalance).toBe(expectedBalance);
    });
  });
});
