import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { BalanceAuditService } from '../balance-audit';
import { SettingsService } from '../settings';
import { FeedbackService } from '../feedback/feedback.service';
import {
  UpdateEventDto,
  AdjustBalanceDto,
  UpdateSettingsDto,
  UpdateTournamentDto,
} from './dto';

@Controller('api/admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private balanceAudit: BalanceAuditService,
    private settings: SettingsService,
    private feedbackService: FeedbackService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  @Patch('events/:id')
  updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.adminService.updateEvent(id, dto);
  }

  @Get('tournaments')
  listTournaments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('game') game?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listTournaments({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      game,
      search,
    });
  }

  @Patch('tournaments/:id')
  updateTournament(@Param('id') id: string, @Body() dto: UpdateTournamentDto) {
    return this.adminService.updateTournament(id, dto);
  }

  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get('users/:id')
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch('users/:id/balance')
  adjustBalance(@Param('id') id: string, @Body() dto: AdjustBalanceDto) {
    return this.adminService.adjustBalance(id, dto);
  }

  @Get('stats')
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('jobs')
  getJobSchedules() {
    return this.adminService.getJobSchedules();
  }

  @Get('balance-audit')
  getBalanceAudit(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('reason') reason?: string,
  ) {
    return this.balanceAudit.getAllAuditLog({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      userId,
      reason,
    });
  }

  @Get('feedback')
  getFeedback(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.feedbackService.getAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
