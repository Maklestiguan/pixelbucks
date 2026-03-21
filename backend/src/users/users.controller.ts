import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { BalanceAuditService } from '../balance-audit';
import { UpdateProfileDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private balanceAudit: BalanceAuditService,
  ) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.usersService.getLeaderboard();
  }

  @Get('me/balance-history')
  getMyBalanceHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    return this.balanceAudit.getUserAuditLog(
      userId,
      page ? parseInt(page, 10) : 1,
    );
  }

  @Get(':id/stats')
  getStats(
    @Param('id') targetUserId: string,
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: string,
  ) {
    return this.usersService.getStats(targetUserId, requesterId, requesterRole);
  }
}
