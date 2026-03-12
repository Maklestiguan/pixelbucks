import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BetsService } from './bets.service';
import { PlaceBetDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/bets')
export class BetsController {
  constructor(private betsService: BetsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  placeBet(@CurrentUser('id') userId: string, @Body() dto: PlaceBetDto) {
    return this.betsService.placeBet(userId, dto);
  }

  @Get('my')
  getMyBets(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.betsService.getMyBets(userId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('my/active')
  getActiveBets(@CurrentUser('id') userId: string) {
    return this.betsService.getActiveBets(userId);
  }
}
