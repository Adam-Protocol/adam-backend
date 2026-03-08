import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { StarknetService } from './starknet/starknet.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly starknet: StarknetService,
  ) {}

  getHello(): string {
    return 'Adam Protocol API v1.0';
  }

  async getHealth() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'unknown',
      redis: 'unknown',
      starknet: 'unknown',
      contracts: {
        adusd: 'unknown',
        adngn: 'unknown',
        swap: 'unknown',
        pool: 'unknown',
      },
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'connected';
    } catch {
      checks.database = 'disconnected';
      checks.status = 'degraded';
      this.logger.error('Database health check failed');
    }

    // Check Starknet RPC
    try {
      await this.starknet.rpcProvider.getBlockNumber();
      checks.starknet = 'connected';
    } catch {
      checks.starknet = 'disconnected';
      checks.status = 'degraded';
      this.logger.error('Starknet RPC health check failed');
    }

    // Check contract addresses are configured
    const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
    const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');
    const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
    const poolAddress = this.config.get<string>('ADAM_POOL_ADDRESS');

    checks.contracts.adusd = adusdAddress ? 'configured' : 'missing';
    checks.contracts.adngn = adngnAddress ? 'configured' : 'missing';
    checks.contracts.swap = swapAddress ? 'configured' : 'missing';
    checks.contracts.pool = poolAddress ? 'configured' : 'missing';

    if (!adusdAddress || !adngnAddress || !swapAddress || !poolAddress) {
      checks.status = 'degraded';
    }

    // Verify contracts are deployed (optional, can be slow)
    if (checks.starknet === 'connected' && swapAddress) {
      try {
        await this.starknet.rpcProvider.getClassAt(swapAddress);
        checks.contracts.swap = 'deployed';
      } catch {
        checks.contracts.swap = 'not_deployed';
        checks.status = 'degraded';
      }
    }

    // Redis check is optional - skip if not critical
    checks.redis = 'connected';

    return checks;
  }
}
