import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { ZkProofService } from './zk-proof.service';
import { StealthService } from './stealth.service';
import { PrivacyController } from './privacy.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, ZkProofService, StealthService],
  exports: [PrivacyService, ZkProofService, StealthService],
})
export class PrivacyModule {}
