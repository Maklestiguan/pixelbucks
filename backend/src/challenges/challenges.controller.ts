import { Controller, Get } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/challenges')
export class ChallengesController {
  constructor(private challengesService: ChallengesService) {}

  @Get()
  getActiveChallenges(@CurrentUser('id') userId: string) {
    return this.challengesService.getActiveChallenges(userId);
  }
}
