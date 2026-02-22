import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChainTxProcessor } from './chain-tx.processor';
import { OfframpModule } from '../offramp/offramp.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'chain-tx' }),
    BullModule.registerQueue({ name: 'offramp' }),
    OfframpModule,
  ],
  providers: [ChainTxProcessor],
})
export class QueueModule {}
