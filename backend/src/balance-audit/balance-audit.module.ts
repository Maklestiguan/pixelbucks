import { Global, Module } from '@nestjs/common';
import { BalanceAuditService } from './balance-audit.service';
import { BalanceAuditConsumer } from './balance-audit.consumer';

@Global()
@Module({
  providers: [BalanceAuditService, BalanceAuditConsumer],
  exports: [BalanceAuditService],
})
export class BalanceAuditModule {}
