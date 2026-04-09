import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

export const CHAT_QUEUE = 'chat';

@Processor(CHAT_QUEUE)
export class ChatCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatCleanupProcessor.name);

  constructor(private chatService: ChatService) {
    super();
  }

  async process() {
    const deleted = await this.chatService.cleanupOldMessages(14);
    this.logger.log(`Chat cleanup job done: ${deleted} messages removed`);
    return { deleted };
  }
}
