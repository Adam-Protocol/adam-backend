import { Module, Global } from '@nestjs/common';
import { StarknetService } from './starknet.service';
import { EventListenerService } from './event-listener.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [StarknetService, EventListenerService],
  exports: [StarknetService, EventListenerService],
})
export class StarknetModule {}
