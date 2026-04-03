import { Module, Global } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { ChainManagerService } from './providers/chain-manager.service';
import { StarknetChainHandler } from '../starknet/starknet.chain-handler';
import { StacksChainHandler } from '../stacks/stacks.chain-handler';

@Global()
@Module({
  providers: [TransactionService, ChainManagerService, StarknetChainHandler, StacksChainHandler],
  exports: [TransactionService, ChainManagerService, StarknetChainHandler, StacksChainHandler],
})
export class CommonModule {}
