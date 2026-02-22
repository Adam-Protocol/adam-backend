import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'chain-tx' })],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
