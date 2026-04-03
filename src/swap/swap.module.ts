import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { ContractRatesService } from './contract-rates.service';
import { OfframpModule } from '../offramp/offramp.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'chain-tx' }), OfframpModule],
  controllers: [SwapController],
  providers: [SwapService, ContractRatesService],
  exports: [SwapService, ContractRatesService],
})
export class SwapModule { }
