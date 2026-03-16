import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { BetsModule } from './bets/bets.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { OutboxModule } from './outbox/outbox.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { ChallengesModule } from './challenges/challenges.module';
import { FeedbackModule } from './feedback/feedback.module';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '60', 10),
      },
    ]),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          createKeyv(config.get<string>('REDIS_URL', 'redis://localhost:6777')),
        ],
        ttl: 30 * 1000, // 30s default TTL (milliseconds)
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: new URL(
            config.get<string>('REDIS_URL', 'redis://localhost:6777'),
          ).hostname,
          port: parseInt(
            new URL(config.get<string>('REDIS_URL', 'redis://localhost:6777'))
              .port || '6379',
            10,
          ),
        },
      }),
    }),
    PrismaModule,
    RabbitMQModule,
    OutboxModule,
    AuthModule,
    UsersModule,
    EventsModule,
    BetsModule,
    ChatModule,
    AdminModule,
    ChallengesModule,
    FeedbackModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
