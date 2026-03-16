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

  /** Initiate a buy: validate then record transaction (execution happens on frontend) */
  async buy(dto: BuyTokenDto) {
    // Check if this exact commitment already exists for a buy transaction
    // (same commitment can be used for sell, but not for multiple buys)
    const existing = await this.prisma.transaction.findFirst({
      where: {
        commitment: dto.commitment,
        type: 'buy',
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Commitment already used for a buy transaction',
      );
    }

    // Use custom transactionId if provided, otherwise let Prisma generate one
    const txData: {
      wallet: string;
      type: string;
      commitment: string;
      token_in: string;
      token_out: string;
      status: string;
      tx_hash: string | null;
      id?: string;
    } = {
      wallet: dto.wallet,
      type: 'buy',
      commitment: dto.commitment,
      token_in: 'USDC',
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
      `Buy transaction recorded for wallet ${dto.wallet}, tx_hash: ${dto.tx_hash || 'pending'}`,
    );
    return { transaction_id: tx.id, status: tx.status, tx_hash: tx.tx_hash };
  }

  /** Initiate a sell: validate nullifier then trigger bank transfer */
  async sell(dto: SellTokenDto) {
    const existing = await this.prisma.transaction.findFirst({
      where: { nullifier: dto.nullifier },
    });
    if (existing) {
      throw new BadRequestException('Nullifier already spent');
    }

    // Since a sell can return multiple change commitments or none, 
    // we take the first one to satisfy the DB schema, or use a placeholder if empty.
    const primaryCommitment =
      dto.new_commitments && dto.new_commitments.length > 0
        ? dto.new_commitments[0]
        : '0x0';

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
      currency: string;
      bank_account: string;
      bank_code: string;
      id?: string;
    } = {
      wallet: dto.wallet,
      type: 'sell',
      commitment: primaryCommitment,
      nullifier: dto.nullifier,
      token_in: dto.token_in.toUpperCase(),
      token_out: 'FIAT',
      status: dto.tx_hash ? 'completed' : 'pending',
      tx_hash: dto.tx_hash || null,
      currency: dto.currency,
      bank_account: dto.bank_account,
      bank_code: dto.bank_code,
    };

    if (dto.transactionId) {
      txData.id = dto.transactionId;
    }

    const tx = await this.prisma.transaction.create({
      data: txData,
    });

    // If transaction hash is provided, trigger bank transfer immediately
    if (dto.tx_hash && dto.bank_account && dto.bank_code) {
      const job = await this.chainTxQueue.add(
        'process-bank-transfer',
        {
          transactionId: tx.id,
          amount: dto.amount,
          currency: dto.currency,
          bank_account: dto.bank_account,
          bank_code: dto.bank_code,
          token_in: dto.token_in,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(
        `Bank transfer job ${job.id} enqueued for transaction ${tx.id}`,
      );
    }

    this.logger.log(
      `Sell transaction recorded for wallet ${dto.wallet}, tx_hash: ${dto.tx_hash || 'pending'}`,
    );
    return { transaction_id: tx.id, status: tx.status, tx_hash: tx.tx_hash };
  }

  /** Get token balances for a wallet */
  async getBalances(wallet: string) {
    try {
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
      const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');
      const adkesAddress = this.config.get<string>('ADKES_ADDRESS');
      const adghsAddress = this.config.get<string>('ADGHS_ADDRESS');
      const adzarAddress = this.config.get<string>('ADZAR_ADDRESS');
      const usdcAddress = this.config.get<string>('USDC_ADDRESS');

      if (!adusdAddress || !adngnAddress) {
        throw new Error('Token addresses not configured');
      }

      const [adusdBalance, adngnBalance, adkesBalance, adghsBalance, adzarBalance, usdcBalance] = await Promise.all([
        this.starknet.getBalance(adusdAddress, wallet),
        this.starknet.getBalance(adngnAddress, wallet),
        adkesAddress ? this.starknet.getBalance(adkesAddress, wallet) : Promise.resolve(0n),
        adghsAddress ? this.starknet.getBalance(adghsAddress, wallet) : Promise.resolve(0n),
        adzarAddress ? this.starknet.getBalance(adzarAddress, wallet) : Promise.resolve(0n),
        usdcAddress ? this.starknet.getBalance(usdcAddress, wallet) : Promise.resolve(0n),
      ]);

      // All Adam tokens have 18 decimals, USDC has 6 decimals
      const adusdFormatted = Number(adusdBalance) / 1e18;
      const adngnFormatted = Number(adngnBalance) / 1e18;
      const adkesFormatted = Number(adkesBalance) / 1e18;
      const adghsFormatted = Number(adghsBalance) / 1e18;
      const adzarFormatted = Number(adzarBalance) / 1e18;
      const usdcFormatted = Number(usdcBalance) / 1e6;

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
          adkes: {
            raw: adkesBalance.toString(),
            formatted: adkesFormatted.toFixed(2),
            decimals: 18,
          },
          adghs: {
            raw: adghsBalance.toString(),
            formatted: adghsFormatted.toFixed(2),
            decimals: 18,
          },
          adzar: {
            raw: adzarBalance.toString(),
            formatted: adzarFormatted.toFixed(2),
            decimals: 18,
          },
          usdc: {
            raw: usdcBalance.toString(),
            formatted: usdcFormatted.toFixed(2),
            decimals: 6,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch balances for ${wallet}`, error);
      throw error;
    }
  }

  /** Get all buy commitments for a wallet that can be used for selling */
  async getCommitments(wallet: string) {
    const commitments = await this.prisma.transaction.findMany({
      where: {
        wallet,
        type: 'buy',
        status: 'completed',
      },
      select: {
        id: true,
        commitment: true,
        token_out: true,
        created_at: true,
        status: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return commitments;
  }
}
