import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ChainManagerService, ChainType } from '../common/providers/chain-manager.service';
import { BuyTokenDto, SellTokenDto } from './token.dto';

/** Token contract addresses keyed by chain then by symbol */
const CHAIN_TOKEN_ADDRESSES: Record<string, Record<string, string | undefined>> = {
  [ChainType.STARKNET]: {
    ADUSD: process.env.ADUSD_ADDRESS,
    ADNGN: process.env.ADNGN_ADDRESS,
    ADKES: process.env.ADKES_ADDRESS,
    ADGHS: process.env.ADGHS_ADDRESS,
    ADZAR: process.env.ADZAR_ADDRESS,
    USDC: process.env.USDC_ADDRESS,
  },
  [ChainType.STACKS]: {
    ADUSD: process.env.STACKS_ADUSD_ADDRESS,
    ADNGN: process.env.STACKS_ADNGN_ADDRESS,
    ADKES: process.env.STACKS_ADKES_ADDRESS,
    ADGHS: process.env.STACKS_ADGHS_ADDRESS,
    ADZAR: process.env.STACKS_ADZAR_ADDRESS,
    USDC: process.env.STACKS_USDCx_ADDRESS,
  },
};

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly chainManager: ChainManagerService,
    @InjectQueue('chain-tx') private readonly chainTxQueue: Queue,
  ) { }

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
      chain: string;
      id?: string;
    } = {
      wallet: dto.wallet,
      type: 'buy',
      commitment: dto.commitment,
      token_in: 'USDC',
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
      chain: string;
      id?: string;
    } = {
      wallet: dto.wallet,
      type: 'sell',
      commitment: dto.commitment,
      nullifier: dto.nullifier,
      token_in: dto.token_in.toUpperCase(),
      token_out: 'FIAT',
      status: dto.tx_hash ? 'completed' : 'pending',
      tx_hash: dto.tx_hash || null,
      currency: dto.currency,
      bank_account: dto.bank_account,
      bank_code: dto.bank_code,
      chain: dto.chain || 'STARKNET',
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

  /** Get token balances for a wallet on the specified chain */
  async getBalances(wallet: string, chain: string = ChainType.STARKNET) {
    const normalizedChain = chain.toUpperCase();
    const provider = this.chainManager.getProvider(normalizedChain);
    const tokenAddresses = CHAIN_TOKEN_ADDRESSES[normalizedChain];

    if (!tokenAddresses) {
      throw new BadRequestException(`Unsupported chain: ${chain}`);
    }

    try {
      const tokens = ['ADUSD', 'ADNGN', 'ADKES', 'ADGHS', 'ADZAR', 'USDC'];

      // Decimals are chain-specific
      // Starknet: ADUSD/ADNGN/ADKES/ADGHS/ADZAR have 18 decimals, USDC has 6
      // Stacks: All tokens have 6 decimals
      const decimalsMap: Record<string, number> =
        normalizedChain === ChainType.STARKNET
          ? { ADUSD: 18, ADNGN: 18, ADKES: 18, ADGHS: 18, ADZAR: 18, USDC: 6 }
          : { ADUSD: 6, ADNGN: 6, ADKES: 6, ADGHS: 6, ADZAR: 6, USDC: 6 };

      // Add STX for Stacks chain
      if (normalizedChain === ChainType.STACKS) {
        tokens.push('STX');
        decimalsMap['STX'] = 6;
      }
 
      const balances = await Promise.all(
        tokens.map((symbol) => {
          const address = tokenAddresses[symbol];
          // For STX, use 'native' as the token address
          if (symbol === 'STX') {
            return provider.getBalance('native', wallet);
          }
          if (!address) return Promise.resolve(0n);
          return provider.getBalance(address, wallet);
        }),
      );

      const result: Record<string, { raw: string; formatted: string; decimals: number }> = {};
      tokens.forEach((symbol, i) => {
        const decimals = decimalsMap[symbol];
        const raw = balances[i];
        const formatted = (Number(raw) / 10 ** decimals).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        result[symbol.toLowerCase()] = { raw: raw.toString(), formatted, decimals };
      });

      return { wallet, chain: normalizedChain, balances: result };
    } catch (error) {
      this.logger.error(`Failed to fetch balances for ${wallet} on ${chain}`, error);
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
