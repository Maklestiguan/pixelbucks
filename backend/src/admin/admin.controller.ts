import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { BalanceAuditService } from '../balance-audit';
import { FeedbackService } from '../feedback/feedback.service';
import { UpdateEventDto, AdjustBalanceDto } from './dto';

@Controller('api/admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private balanceAudit: BalanceAuditService,
    private feedbackService: FeedbackService,
  ) {}

  @Patch('events/:id')
  updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.adminService.updateEvent(id, dto);
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
