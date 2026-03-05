import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OfframpController } from './offramp.controller';
import { FlutterwaveService } from './flutterwave.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'offramp' })],
  controllers: [OfframpController],
  providers: [FlutterwaveService],
  exports: [FlutterwaveService],
})
export class OfframpModule {}
