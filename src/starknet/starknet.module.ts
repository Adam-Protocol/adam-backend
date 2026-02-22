import { Module, Global } from '@nestjs/common';
import { StarknetService } from './starknet.service';

@Global()
@Module({
  providers: [StarknetService],
  exports: [StarknetService],
})
export class StarknetModule {}
