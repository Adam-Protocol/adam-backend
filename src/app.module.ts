import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { StarknetModule } from './starknet/starknet.module';
import { TokenModule } from './token/token.module';
import { SwapModule } from './swap/swap.module';
import { OfframpModule } from './offramp/offramp.module';
import { ActivityModule } from './activity/activity.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
      },
    }),
    PrismaModule,
    StarknetModule,
    QueueModule,
    TokenModule,
    SwapModule,
    OfframpModule,
    ActivityModule,
  ],
})
export class AppModule {}
