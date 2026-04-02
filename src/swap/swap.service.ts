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
import { SUPPORTED_CURRENCIES, CURRENCY_PAIRS } from './currency-rates.config';

interface CurrencyRate {
  rate: number;
  updated_at: Date;
  source: RateSource;
}

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private cachedRates: Map<string, CurrencyRate> = new Map();
  private defaultRateSource: RateSource = RateSource.EXCHANGE_RATE_API;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flutterwave: FlutterwaveService,
    @InjectQueue('chain-tx') private readonly chainTxQueue: Queue,
  ) { }

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

  /** Get live USD/NGN rate from cache or fetch from source (legacy endpoint) */
  async getLiveRate(): Promise<{
    usd_ngn: number;
    updated_at: Date | null;
    source: RateSource;
  }> {
    const ngnRate = this.cachedRates.get('NGN');
    if (ngnRate) {
      return {
        usd_ngn: ngnRate.rate,
        updated_at: ngnRate.updated_at,
        source: ngnRate.source,
      };
    }
    await this.refreshRate();
    const refreshedRate = this.cachedRates.get('NGN');
    return {
      usd_ngn: refreshedRate?.rate ?? 0,
      updated_at: refreshedRate?.updated_at ?? null,
      source: refreshedRate?.source ?? this.defaultRateSource,
    };
  }

  /** Get all currency rates */
  async getAllRates(): Promise<
    Record<
      string,
      { rate: number; updated_at: Date | null; source: RateSource }
    >
  > {
    const rates: Record<
      string,
      { rate: number; updated_at: Date | null; source: RateSource }
    > = {
      USD: {
        rate: 1.0,
        updated_at: new Date(),
        source: this.defaultRateSource,
      },
    };
    for (const [currency, data] of this.cachedRates.entries()) {
      rates[currency] = {
        rate: data.rate,
        updated_at: data.updated_at,
        source: data.source,
      };
    }
    return rates;
  }

  /** Fetch rates from ExchangeRate-API for all currencies */
  private async fetchFromExchangeRateApi(): Promise<Record<string, number>> {
    const key = this.config.get<string>('EXCHANGE_RATE_API_KEY');
    const url = `${this.config.get('EXCHANGE_RATE_API_URL')}/${key}/latest/USD`;
    const { data } = await axios.get<{
      conversion_rates: Record<string, number>;
    }>(url);

    const rates: Record<string, number> = {};
    for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
      const config = SUPPORTED_CURRENCIES[currency];
      rates[currency] = data.conversion_rates[config.exchangeRateApiCode];
    }
    return rates;
  }

  /** Fetch rate from Flutterwave for a specific currency */
  private async fetchFromFlutterwave(
    currency: string,
  ): Promise<number | null> {
    try {
      const config = SUPPORTED_CURRENCIES[currency];
      if (!config) return null;
      return await this.flutterwave.getExchangeRate(
        'USD',
        config.flutterwaveCode,
        1,
      );
    } catch {
      return null;
    }
  }

  /** Refresh rates from configured source and enqueue on-chain set_rate calls */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshRate() {
    try {
      let rates: Record<string, number> = {};
      let source: RateSource;

      // Fetch from default source
      if (this.defaultRateSource === RateSource.FLUTTERWAVE) {
        // Try Flutterwave first for each currency
        const flutterwaveRates: Record<string, number> = {};
        for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
          const rate = await this.fetchFromFlutterwave(currency);
          if (rate) flutterwaveRates[currency] = rate;
        }

        if (Object.keys(flutterwaveRates).length > 0) {
          rates = flutterwaveRates;
          source = RateSource.FLUTTERWAVE;
        } else {
          this.logger.warn(
            'Flutterwave rate fetch failed, falling back to ExchangeRate-API',
          );
          rates = await this.fetchFromExchangeRateApi();
          source = RateSource.EXCHANGE_RATE_API;
        }
      } else {
        try {
          rates = await this.fetchFromExchangeRateApi();
          source = RateSource.EXCHANGE_RATE_API;
        } catch {
          this.logger.warn(
            'ExchangeRate-API fetch failed, falling back to Flutterwave',
          );
          // Try Flutterwave as fallback
          for (const currency of Object.keys(SUPPORTED_CURRENCIES)) {
            const rate = await this.fetchFromFlutterwave(currency);
            if (rate) rates[currency] = rate;
          }
          source = RateSource.FLUTTERWAVE;
        }
      }

      // Cache all rates
      const now = new Date();
      for (const [currency, rate] of Object.entries(rates)) {
        this.cachedRates.set(currency, { rate, updated_at: now, source });
        this.logger.log(
          `Rate refreshed from ${source}: 1 USD = ${rate} ${currency}`,
        );
      }

      // Push all rates on-chain via queue (RATE_SETTER_ROLE backend wallet)
      // Push to Starknet
      await this.chainTxQueue.add(
        'push-rates',
        { rates },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );

      // Push to Stacks
      await this.chainTxQueue.add(
        'push-rates-stacks',
        { rates },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );

      // Return NGN rate for backward compatibility
      const ngnRate = this.cachedRates.get('NGN');
      return {
        usd_ngn: ngnRate?.rate ?? 0,
        updated_at: ngnRate?.updated_at ?? null,
        source: ngnRate?.source ?? source,
      };
    } catch (err) {
      this.logger.error('Rate refresh failed from all sources', err);
      const ngnRate = this.cachedRates.get('NGN');
      return {
        usd_ngn: ngnRate?.rate ?? 0,
        updated_at: ngnRate?.updated_at ?? null,
        source: ngnRate?.source ?? this.defaultRateSource,
      };
    }
  }

  /** Record a swap transaction (execution happens on frontend) */
  async swap(dto: SwapDto) {
    // Use custom transactionId if provided, otherwise let Prisma generate one
    const txData: {
      wallet: string;
      type: string;
      commitment: string;
      token_in: string;
      token_out: string;
      status: string;
      tx_hash: string | null;
      chain: string;
      id?: string;
    } = {
      wallet: dto.wallet,
      type: 'swap',
      commitment: dto.commitment,
      token_in: dto.token_in.toUpperCase(),
      token_out: dto.token_out.toUpperCase(),
      status: dto.tx_hash ? 'completed' : 'pending',
      tx_hash: dto.tx_hash || null,
      chain: dto.chain || 'STARKNET',
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
