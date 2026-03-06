import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StarknetService } from '../starknet/starknet.service';
import { BuyTokenDto, SellTokenDto } from './token.dto';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly starknet: StarknetService,
    @InjectQueue('chain-tx') private readonly chainTxQueue: Queue,
  ) {}

  /** Initiate a buy: validate then enqueue on-chain tx */
  async buy(dto: BuyTokenDto) {
    // Check commitment not already used
    const existing = await this.prisma.transaction.findUnique({
      where: { commitment: dto.commitment },
    });
    if (existing) {
      throw new BadRequestException('Commitment already registered');
    }

    const tx = await this.prisma.transaction.create({
      data: {
        wallet: dto.wallet,
        type: 'buy',
        commitment: dto.commitment,
        token_in: 'USDC',
        token_out: dto.token_out.toUpperCase(),
        status: 'pending',
      },
    });

    // Enqueue on-chain buy job
    const job = await this.chainTxQueue.add(
      'submit-buy',
      {
        transactionId: tx.id,
        wallet: dto.wallet,
        amount_in: dto.amount_in,
        token_out: dto.token_out,
        commitment: dto.commitment,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    );

    this.logger.log(`Buy job ${job.id} enqueued for wallet ${dto.wallet}`);
    return { job_id: job.id, transaction_id: tx.id, status: 'pending' };
  }

  /** Initiate a sell: validate nullifier then enqueue async */
  async sell(dto: SellTokenDto) {
    const existing = await this.prisma.transaction.findFirst({
      where: { nullifier: dto.nullifier },
    });
    if (existing) {
      throw new BadRequestException('Nullifier already spent');
    }

    const tx = await this.prisma.transaction.create({
      data: {
        wallet: dto.wallet,
        type: 'sell',
        commitment: dto.commitment,
        nullifier: dto.nullifier,
        token_in: dto.token_in.toUpperCase(),
        token_out: 'FIAT',
        status: 'pending',
        currency: dto.currency,
        bank_account: dto.bank_account,
        bank_code: dto.bank_code,
      },
    });

    const job = await this.chainTxQueue.add(
      'submit-sell',
      {
        transactionId: tx.id,
        wallet: dto.wallet,
        token_in: dto.token_in,
        amount: dto.amount,
        nullifier: dto.nullifier,
        commitment: dto.commitment,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    );

    this.logger.log(`Sell job ${job.id} enqueued for wallet ${dto.wallet}`);
    return { job_id: job.id, transaction_id: tx.id, status: 'pending' };
  }

  /** Get token balances for a wallet */
  async getBalances(wallet: string) {
    try {
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
      const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');

      if (!adusdAddress || !adngnAddress) {
        throw new Error('Token addresses not configured');
      }

      const [adusdBalance, adngnBalance] = await Promise.all([
        this.starknet.getBalance(adusdAddress, wallet),
        this.starknet.getBalance(adngnAddress, wallet),
      ]);

      // Both ADUSD and ADNGN have 18 decimals
      const adusdFormatted = Number(adusdBalance) / 1e18;
      const adngnFormatted = Number(adngnBalance) / 1e18;

      return {
        wallet,
        balances: {
          adusd: {
            raw: adusdBalance.toString(),
            formatted: adusdFormatted.toFixed(2),
            decimals: 18,
          },
          adngn: {
            raw: adngnBalance.toString(),
            formatted: adngnFormatted.toFixed(2),
            decimals: 18,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch balances for ${wallet}`, error);
      throw error;
    }
  }
}
