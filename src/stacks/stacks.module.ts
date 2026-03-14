import { Module, Global } from '@nestjs/common';
import { StacksService } from './stacks.service';

@Global()
@Module({
  providers: [StacksService],
  exports: [StacksService],
})
export class StacksModule {}
