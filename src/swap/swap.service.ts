import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { FlutterwaveService } from '../offramp/flutterwave.service';
import { SwapDto } from './swap.dto';
import { RateSource } from './rate-source.enum';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private cachedRate: { usd_ngn: number; updated_at: Date; source: RateSource } | null = null;
  private defaultRateSource: RateSource = RateSource.EXCHANGE_RATE_API;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flutterwave: FlutterwaveService,
    @InjectQueue('chain-tx') private readonly chainTxQueue: Queue,
  ) {}

  /** Get current default rate source */
  getDefaultRateSource(): RateSource {
    return this.defaultRateSource;
  }

  /** Set default rate source */
  setDefaultRateSource(source: RateSource): { source: RateSource; message: string } {
    if (!Object.values(RateSource).includes(source)) {
      throw new Error(`Invalid rate source. Must be one of: ${Object.values(RateSource).join(', ')}`);
    }
    this.defaultRateSource = source;
    this.logger.log(`Default rate source changed to: ${source}`);
    return {
      source: this.defaultRateSource,
      message: `Default rate source set to ${source}`,
    };
  }

  /** Get live USD/NGN rate from cache or fetch from source */
  async getLiveRate(): Promise<{ usd_ngn: number; updated_at: Date | null; source: RateSource }> {
    if (this.cachedRate) {
      return {
        usd_ngn: this.cachedRate.usd_ngn,
        updated_at: this.cachedRate.updated_at,
        source: this.cachedRate.source,
      };
    }
    return this.refreshRate();
  }

  /** Fetch rate from ExchangeRate-API */
  private async fetchFromExchangeRateApi(): Promise<number> {
    const key = this.config.get<string>('EXCHANGE_RATE_API_KEY');
    const url = `${this.config.get('EXCHANGE_RATE_API_URL')}/${key}/latest/USD`;
    const { data } = await axios.get(url);
    return data.conversion_rates.NGN;
  }

  /** Fetch rate from Flutterwave */
  private async fetchFromFlutterwave(): Promise<number> {
    return this.flutterwave.getExchangeRate('USD', 'NGN', 1);
  }

  /** Refresh rate from configured source and enqueue on-chain set_rate call */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshRate() {
    try {
      let usd_ngn: number;
      let source: RateSource;

      // Fetch from default source
      if (this.defaultRateSource === RateSource.FLUTTERWAVE) {
        try {
          usd_ngn = await this.fetchFromFlutterwave();
          source = RateSource.FLUTTERWAVE;
        } catch (err) {
          this.logger.warn('Flutterwave rate fetch failed, falling back to ExchangeRate-API');
          usd_ngn = await this.fetchFromExchangeRateApi();
          source = RateSource.EXCHANGE_RATE_API;
        }
      } else {
        try {
          usd_ngn = await this.fetchFromExchangeRateApi();
          source = RateSource.EXCHANGE_RATE_API;
        } catch (err) {
          this.logger.warn('ExchangeRate-API fetch failed, falling back to Flutterwave');
          usd_ngn = await this.fetchFromFlutterwave();
          source = RateSource.FLUTTERWAVE;
        }
      }

      this.cachedRate = { usd_ngn, updated_at: new Date(), source };

      // Push rate on-chain via queue (RATE_SETTER_ROLE backend wallet)
      await this.chainTxQueue.add(
        'push-rate',
        { usd_ngn },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );

      this.logger.log(`Rate refreshed from ${source}: 1 USD = ${usd_ngn} NGN`);
      return { usd_ngn, updated_at: this.cachedRate.updated_at, source };
    } catch (err) {
      this.logger.error('Rate refresh failed from all sources', err);
      return {
        usd_ngn: this.cachedRate?.usd_ngn ?? 0,
        updated_at: this.cachedRate?.updated_at ?? null,
        source: this.cachedRate?.source ?? this.defaultRateSource,
      };
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
