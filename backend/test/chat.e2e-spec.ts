import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma';
import { ChatService } from '../src/chat/chat.service';
import { FastestValidatorPipe } from '../src/common/pipes/validation.pipe';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Chat E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let chatService: ChatService;
  let token: string;
  let baseUrl: string;

  function createSocket(authToken: string): Socket {
    return io(baseUrl, {
      auth: { token: authToken },
      transports: ['websocket'],
      forceNew: true,
    });
  }

  function waitForEvent<T>(
    socket: Socket,
    event: string,
    timeoutMs = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout waiting for "${event}"`)),
        timeoutMs,
      );
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new FastestValidatorPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Must use listen() for WebSocket gateway to work
    await app.listen(0);
    const url = await app.getUrl();
    baseUrl = url.replace('[::1]', 'localhost');

    prisma = app.get(PrismaService);
    chatService = app.get(ChatService);

    // Clean up
    await prisma.chatMessage.deleteMany({});
    await prisma.bet.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.userChallenge.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.outboxEvent.deleteMany({});

    // Register a test user
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ username: 'chatuser', password: 'password123' })
      .expect(201);

    token = res.body.accessToken;
  }, 30000);

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({});
    await prisma.bet.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.userChallenge.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await app.close();
  });

  it('should reject connection without token', (done) => {
    let finished = false;
    const socket = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('error', (data: { message: string }) => {
      expect(data.message).toBe('Authentication required');
      socket.disconnect();
      if (!finished) {
        finished = true;
        done();
      }
    });

    socket.on('disconnect', () => {
      if (!finished) {
        finished = true;
        done();
      }
    });
  });

  it('should reject connection with invalid token', (done) => {
    let finished = false;
    const socket = io(baseUrl, {
      auth: { token: 'invalid-jwt-token' },
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('error', (data: { message: string }) => {
      expect(data.message).toBe('Invalid token');
      socket.disconnect();
      if (!finished) {
        finished = true;
        done();
      }
    });

    socket.on('disconnect', () => {
      if (!finished) {
        finished = true;
        done();
      }
    });
  });

  it('should connect with valid token', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });
  });

  it('should join a room and receive history', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit(
        'join_room',
        { room: 'en' },
        (res: { room: string; history: unknown[] }) => {
          expect(res.room).toBe('en');
          expect(Array.isArray(res.history)).toBe(true);
          socket.disconnect();
          done();
        },
      );
    });
  });

  it('should reject invalid room', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit(
        'join_room',
        { room: 'invalid' },
        (res: { error: string }) => {
          expect(res.error).toContain('Invalid room');
          socket.disconnect();
          done();
        },
      );
    });
  });

  it('should send and receive messages', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit('join_room', { room: 'en' }, () => {
        socket.on(
          'new_message',
          (msg: {
            content: string;
            user: { username: string };
            room: string;
          }) => {
            expect(msg.content).toBe('Hello world!');
            expect(msg.user.username).toBe('chatuser');
            expect(msg.room).toBe('en');
            socket.disconnect();
            done();
          },
        );

        socket.emit(
          'send_message',
          { content: 'Hello world!' },
          (res: { ok: boolean }) => {
            expect(res.ok).toBe(true);
          },
        );
      });
    });
  });

  it('should reject empty message', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit('join_room', { room: 'en' }, () => {
        socket.emit(
          'send_message',
          { content: '   ' },
          (res: { error: string }) => {
            expect(res.error).toContain('empty');
            socket.disconnect();
            done();
          },
        );
      });
    });
  });

  it('should reject message exceeding 120 chars', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit('join_room', { room: 'en' }, () => {
        const longMsg = 'a'.repeat(121);
        socket.emit(
          'send_message',
          { content: longMsg },
          (res: { error: string }) => {
            expect(res.error).toContain('too long');
            socket.disconnect();
            done();
          },
        );
      });
    });
  });

  it('should enforce rate limiting (1 msg per 2s)', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit('join_room', { room: 'en' }, () => {
        // Send first message
        socket.emit(
          'send_message',
          { content: 'msg1' },
          (res1: { ok?: boolean }) => {
            expect(res1.ok).toBe(true);

            // Immediately send second message
            socket.emit(
              'send_message',
              { content: 'msg2' },
              (res2: { error?: string }) => {
                expect(res2.error).toContain('Too fast');
                socket.disconnect();
                done();
              },
            );
          },
        );
      });
    });
  });

  it('should reject message when not in a room', (done) => {
    const socket = createSocket(token);

    socket.on('connect', () => {
      socket.emit(
        'send_message',
        { content: 'test' },
        (res: { error: string }) => {
          expect(res.error).toContain('Join a room');
          socket.disconnect();
          done();
        },
      );
    });
  });

  it('should persist messages to database', async () => {
    // Wait for any pending writes
    await new Promise((r) => setTimeout(r, 500));

    const messages = await prisma.chatMessage.findMany({
      where: { room: 'en' },
      orderBy: { createdAt: 'desc' },
    });

    expect(messages.length).toBeGreaterThanOrEqual(1);
    const found = messages.find((m) => m.content === 'Hello world!');
    expect(found).toBeDefined();
  });

  it('should return history on join (100 max)', async () => {
    const history = await chatService.getHistory('en', 100);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('should cleanup old messages', async () => {
    // Insert a message with old date
    await prisma.chatMessage.create({
      data: {
        userId: (await prisma.user.findFirst())!.id,
        room: 'en',
        content: 'old message',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      },
    });

    const deleted = await chatService.cleanupOldMessages(14);
    expect(deleted).toBeGreaterThanOrEqual(1);

    // Verify old message is gone
    const remaining = await prisma.chatMessage.findMany({
      where: { content: 'old message' },
    });
    expect(remaining.length).toBe(0);
  });
});
