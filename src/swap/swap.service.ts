import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { SwapDto } from './swap.dto';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private cachedRate: { usd_ngn: number; updated_at: Date } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('chain-tx') private readonly chainTxQueue: Queue,
  ) {}

  /** Get live USD/NGN rate from cache or ExchangeRate-API */
  async getLiveRate(): Promise<{ usd_ngn: number; updated_at: Date | null }> {
    if (this.cachedRate) {
      return { usd_ngn: this.cachedRate.usd_ngn, updated_at: this.cachedRate.updated_at };
    }
    return this.refreshRate();
  }

  /** Refresh rate from ExchangeRate-API and enqueue on-chain set_rate call */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshRate() {
    try {
      const key = this.config.get<string>('EXCHANGE_RATE_API_KEY');
      const url = `${this.config.get('EXCHANGE_RATE_API_URL')}/${key}/latest/USD`;
      const { data } = await axios.get(url);
      const usd_ngn: number = data.conversion_rates.NGN;
      this.cachedRate = { usd_ngn, updated_at: new Date() };

      // Push rate on-chain via queue (RATE_SETTER_ROLE backend wallet)
      await this.chainTxQueue.add(
        'push-rate',
        { usd_ngn },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );

      this.logger.log(`Rate refreshed: 1 USD = ${usd_ngn} NGN`);
      return { usd_ngn, updated_at: this.cachedRate.updated_at };
    } catch (err) {
      this.logger.error('Rate refresh failed', err);
      return { usd_ngn: this.cachedRate?.usd_ngn ?? 0, updated_at: this.cachedRate?.updated_at ?? null };
    }
  }

  /** Enqueue a swap job */
  async swap(dto: SwapDto) {
    const tx = await this.prisma.transaction.create({
      data: {
        wallet: dto.wallet,
        type: 'swap',
        commitment: dto.commitment,
        token_in: dto.token_in.toUpperCase(),
        token_out: dto.token_out.toUpperCase(),
        status: 'pending',
      },
    });

    const job = await this.chainTxQueue.add(
      'submit-swap',
      {
        transactionId: tx.id,
        wallet: dto.wallet,
        token_in: dto.token_in,
        amount_in: dto.amount_in,
        token_out: dto.token_out,
        min_amount_out: dto.min_amount_out,
        commitment: dto.commitment,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );

    return { job_id: job.id, transaction_id: tx.id, status: 'pending' };
  }
}
