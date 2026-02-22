import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'chain-tx' })],
  controllers: [TokenController],
  providers: [TokenService],
})
export class TokenModule {}
