import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import type { MatchStatus } from '@prisma/client';

@Controller('api/events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  listEvents(
    @Query('game') game?: string,
    @Query('status') status?: MatchStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.listEvents({
      game,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  getEvent(@Param('id') id: string) {
    return this.eventsService.getEvent(id);
  }
}
