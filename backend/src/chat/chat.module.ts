import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatCleanupProcessor, CHAT_QUEUE } from './chat-cleanup.processor';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    BullModule.registerQueue({ name: CHAT_QUEUE }),
  ],
  providers: [ChatGateway, ChatService, ChatCleanupProcessor],
  exports: [ChatService],
})
export class ChatModule implements OnModuleInit {
  private readonly logger = new Logger(ChatModule.name);

  constructor(@InjectQueue(CHAT_QUEUE) private chatQueue: Queue) {}

  async onModuleInit() {
    // Clean slate: remove old repeatable jobs and drain stale delayed/waiting jobs
    const jobs = await this.chatQueue.getRepeatableJobs();
    for (const job of jobs) {
      await this.chatQueue.removeRepeatableByKey(job.key);
    }
    await this.chatQueue.drain();

    const pattern = '0 3 * * *'; // 3 AM UTC daily

    const repeatOpts = {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    };

    // Register repeatable job
    await this.chatQueue.add(
      CHAT_QUEUE,
      {},
      { repeat: { pattern }, ...repeatOpts },
    );

    // Fire one-off job to guarantee immediate run on startup
    await this.chatQueue.add(`${CHAT_QUEUE}-now`, {}, repeatOpts);

    this.logger.log(`Chat cleanup job registered (pattern: ${pattern})`);
  }
}
