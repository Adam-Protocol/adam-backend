import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OfframpController } from './offramp.controller';
import { OfframpService } from './offramp.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'offramp' })],
  controllers: [OfframpController],
  providers: [OfframpService],
  exports: [OfframpService],
})
export class OfframpModule {}
