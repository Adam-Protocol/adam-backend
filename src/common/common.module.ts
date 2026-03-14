import { Module, Global } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { ChainManagerService } from './providers/chain-manager.service';

@Global()
@Module({
  providers: [TransactionService, ChainManagerService],
  exports: [TransactionService, ChainManagerService],
})
export class CommonModule {}
