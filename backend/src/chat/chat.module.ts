import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatCleanupProcessor } from './chat-cleanup.processor';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    BullModule.registerQueue({ name: 'chat' }),
  ],
  providers: [ChatGateway, ChatService, ChatCleanupProcessor],
  exports: [ChatService],
})
export class ChatModule implements OnModuleInit {
  private readonly logger = new Logger(ChatModule.name);

  constructor(@InjectQueue('chat') private chatQueue: Queue) {}

  async onModuleInit() {
    // Cleanup old messages daily
    await this.chatQueue.upsertJobScheduler(
      'cleanup-old-messages',
      { pattern: '0 3 * * *' }, // 3 AM UTC daily
      { name: 'cleanup-old-messages' },
    );

    this.logger.log('Chat cleanup job scheduled (daily at 3 AM UTC)');
  }
}
