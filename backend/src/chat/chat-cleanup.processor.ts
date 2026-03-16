import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ChatService } from './chat.service';

@Processor('chat')
export class ChatCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatCleanupProcessor.name);

  constructor(private chatService: ChatService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'cleanup-old-messages') {
      const deleted = await this.chatService.cleanupOldMessages(14);
      this.logger.log(`Chat cleanup job done: ${deleted} messages removed`);
      return { deleted };
    }
  }
}
