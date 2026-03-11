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
  private cachedRate: {
    usd_ngn: number;
    updated_at: Date;
    source: RateSource;
  } | null = null;
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
  setDefaultRateSource(source: RateSource): {
    source: RateSource;
    message: string;
  } {
    if (!Object.values(RateSource).includes(source)) {
      throw new Error(
        `Invalid rate source. Must be one of: ${Object.values(RateSource).join(', ')}`,
      );
    }
    this.defaultRateSource = source;
    this.logger.log(`Default rate source changed to: ${source}`);
    return {
      source: this.defaultRateSource,
      message: `Default rate source set to ${source}`,
    };
  }

  /** Get live USD/NGN rate from cache or fetch from source */
  async getLiveRate(): Promise<{
    usd_ngn: number;
    updated_at: Date | null;
    source: RateSource;
  }> {
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
    const { data } = await axios.get<{
      conversion_rates: { NGN: number };
    }>(url);
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
        } catch {
          this.logger.warn(
            'Flutterwave rate fetch failed, falling back to ExchangeRate-API',
          );
          usd_ngn = await this.fetchFromExchangeRateApi();
          source = RateSource.EXCHANGE_RATE_API;
        }
      } else {
        try {
          usd_ngn = await this.fetchFromExchangeRateApi();
          source = RateSource.EXCHANGE_RATE_API;
        } catch {
          this.logger.warn(
            'ExchangeRate-API fetch failed, falling back to Flutterwave',
          );
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

  /** Record a swap transaction (execution happens on frontend) */
  async swap(dto: SwapDto) {
    // Check if the input note's nullifier was already spent
    const existing = await this.prisma.transaction.findFirst({
      where: { nullifier: dto.nullifier },
    });
    if (existing) {
      throw new Error('Nullifier already spent'); // Throw error instead of BadRequestException since class isn't imported
    }

    // Use custom transactionId if provided, otherwise let Prisma generate one
    const txData: {
      wallet: string;
      type: string;
      commitment: string;
      nullifier: string;
      token_in: string;
      token_out: string;
      status: string;
      tx_hash: string | null;
      id?: string;
    } = {
      wallet: dto.wallet,
      type: 'swap',
      commitment: dto.commitment,
      nullifier: dto.nullifier,
      token_in: dto.token_in.toUpperCase(),
      token_out: dto.token_out.toUpperCase(),
      status: dto.tx_hash ? 'completed' : 'pending',
      tx_hash: dto.tx_hash || null,
    };

    if (dto.transactionId) {
      txData.id = dto.transactionId;
    }

    const tx = await this.prisma.transaction.create({
      data: txData,
    });

    this.logger.log(
      `Swap transaction recorded for wallet ${dto.wallet}, tx_hash: ${dto.tx_hash || 'pending'}`,
    );
    return { transaction_id: tx.id, status: tx.status, tx_hash: tx.tx_hash };
  }
}
