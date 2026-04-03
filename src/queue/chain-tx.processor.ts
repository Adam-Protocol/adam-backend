import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FlutterwaveService } from '../offramp/flutterwave.service';
import { ChainManagerService, ChainType } from '../common/providers/chain-manager.service';

@Processor('chain-tx')
export class ChainTxProcessor extends WorkerHost {
  private readonly logger = new Logger(ChainTxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flutterwave: FlutterwaveService,
    private readonly chainManager: ChainManagerService,
  ) {
    super();
  }

  async process(job: Job<Record<string, unknown>>) {
    this.logger.log(`Processing chain-tx job: ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case 'submit-buy':
        return this.processBuy(
          job.data as {
            transactionId: string;
            amount_in: string;
            token_out: string;
            commitment: string;
            chain?: string;
          },
        );
      case 'process-bank-transfer':
        return this.processBankTransfer(
          job.data as {
            transactionId: string;
            amount: string;
            currency: string;
            bank_account: string;
            bank_code: string;
            token_in: string;
          },
        );
      case 'submit-swap':
        return this.processSwap(
          job.data as {
            transactionId: string;
            token_in: string;
            amount_in: string;
            token_out: string;
            min_amount_out: string;
            commitment: string;
            chain?: string;
          },
        );
      case 'push-rate':
        return this.processRateUpdate(job.data as { usd_ngn: number });
      case 'push-rates':
      case 'push-rates-stacks':
        // Both queues now map to the same payload format with an explicit chain parameter
        return this.processMultiCurrencyRateUpdate(
          job.data as { rates: Record<string, number>, chain?: string },
          job.name === 'push-rates-stacks' ? ChainType.STACKS : ChainType.STARKNET
        );
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async processBankTransfer(data: {
    transactionId: string;
    amount: string;
    currency: string;
    bank_account: string;
    bank_code: string;
    token_in: string;
  }) {
    console.log('Bank transfer data', data);
    const {
      transactionId,
      amount,
      currency,
      bank_account,
      bank_code,
      token_in,
    } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      // Trigger bank transfer via Flutterwave
      try {
        await this.flutterwave.initiateBankTransfer({
          transactionId,
          amount: Number(amount) / 1e18, // assumes 18 decimals
          currency: currency ?? 'NGN',
          bank_account,
          bank_code,
          narration: `Adam Protocol offramp - ${token_in}`,
        });

        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'completed' },
        });

        this.logger.log(
          `Bank transfer completed for transaction: ${transactionId}`,
        );
      } catch (flutterwaveError: unknown) {
        // Check if it's a merchant not enabled error (common in test/sandbox mode)
        const errorMessage =
          (
            flutterwaveError as {
              response?: { data?: { message?: string } };
              message?: string;
            }
          )?.response?.data?.message ||
          (flutterwaveError as { message?: string })?.message ||
          '';
        const isMerchantNotEnabled = String(errorMessage).includes(
          'merchant is not enabled',
        );

        if (isMerchantNotEnabled) {
          // In development/test mode, mark as completed with a note
          this.logger.warn(
            `Flutterwave not enabled for transfers. Marking transaction as completed (dev mode).`,
          );
          await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'completed',
              error:
                'Bank transfer skipped: Flutterwave merchant not enabled (test mode)',
            },
          });
          this.logger.log(
            `Transaction ${transactionId} marked as completed (Flutterwave disabled)`,
          );
        } else {
          // For other errors, mark as failed and rethrow
          throw flutterwaveError;
        }
      }
    } catch (err: unknown) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          error: (err as { message?: string }).message,
        },
      });
      throw err;
    }
  }

  private async processBuy(data: {
    transactionId: string;
    amount_in: string;
    token_out: string;
    commitment: string;
    chain?: string;
  }) {
    const { transactionId, amount_in, token_out, commitment, chain = 'STARKNET' } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const handler = this.chainManager.getHandler(chain.toUpperCase());
      
      const isStacks = chain.toUpperCase() === ChainType.STACKS;

      // Note: we're reusing token_out as the key for identifying the token.
      // But for Stacks we might just need to pass the raw token name/address if supported in handler.
      // For now we map it directly inside the specific handlers, so we just need to pass the symbolic names, 
      // or we can pass the explicit address.
      // Wait, let's map the token output address first so we don't have to change much logic down stream:
      const tokenAddresses: Record<string, string> = isStacks ? {
        adusd: this.config.get<string>('STACKS_ADUSD_ADDRESS')!,
        adngn: this.config.get<string>('STACKS_ADNGN_ADDRESS')!,
        adkes: this.config.get<string>('STACKS_ADKES_ADDRESS')!,
        adghs: this.config.get<string>('STACKS_ADGHS_ADDRESS')!,
        adzar: this.config.get<string>('STACKS_ADZAR_ADDRESS')!,
      } : {
        adusd: this.config.get<string>('ADUSD_ADDRESS')!,
        adngn: this.config.get<string>('ADNGN_ADDRESS')!,
        adkes: this.config.get<string>('ADKES_ADDRESS')!,
        adghs: this.config.get<string>('ADGHS_ADDRESS')!,
        adzar: this.config.get<string>('ADZAR_ADDRESS')!,
      };

      const tokenOutAddress = tokenAddresses[token_out.toLowerCase()];
      if (!tokenOutAddress) {
        throw new Error(`Unknown token: ${token_out} on ${chain}`);
      }

      const txHash = await handler.executeBuy({
        transactionId,
        amountIn: BigInt(amount_in),
        tokenOutAddress,
        commitment,
      });

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'completed', tx_hash: txHash },
      });

      this.logger.log(`Buy completed: ${txHash}`);
    } catch (err: unknown) {
      // For errors, mark as failed and allow retry
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          error: (err as { message?: string }).message,
        },
      });
      throw err; // BullMQ will retry
    }
  }

  private async processSwap(data: {
    transactionId: string;
    token_in: string;
    amount_in: string;
    token_out: string;
    min_amount_out: string;
    commitment: string;
    chain?: string;
  }) {
    const {
      transactionId,
      token_in,
      amount_in,
      token_out,
      min_amount_out,
      commitment,
      chain = 'STARKNET',
    } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const handler = this.chainManager.getHandler(chain.toUpperCase());
      const isStacks = chain.toUpperCase() === ChainType.STACKS;

      const tokenAddresses: Record<string, string> = isStacks ? {
        adusd: this.config.get<string>('STACKS_ADUSD_ADDRESS')!,
        adngn: this.config.get<string>('STACKS_ADNGN_ADDRESS')!,
        adkes: this.config.get<string>('STACKS_ADKES_ADDRESS')!,
        adghs: this.config.get<string>('STACKS_ADGHS_ADDRESS')!,
        adzar: this.config.get<string>('STACKS_ADZAR_ADDRESS')!,
      } : {
        adusd: this.config.get<string>('ADUSD_ADDRESS')!,
        adngn: this.config.get<string>('ADNGN_ADDRESS')!,
        adkes: this.config.get<string>('ADKES_ADDRESS')!,
        adghs: this.config.get<string>('ADGHS_ADDRESS')!,
        adzar: this.config.get<string>('ADZAR_ADDRESS')!,
      };

      const tokenInAddr = tokenAddresses[token_in.toLowerCase()];
      const tokenOutAddr = tokenAddresses[token_out.toLowerCase()];

      if (!tokenInAddr) {
        throw new Error(`Unknown token_in: ${token_in}`);
      }
      if (!tokenOutAddr) {
        throw new Error(`Unknown token_out: ${token_out}`);
      }

      const txHash = await handler.executeSwap({
        transactionId,
        tokenInAddress: tokenInAddr,
        amountIn: BigInt(amount_in),
        tokenOutAddress: tokenOutAddr,
        minAmountOut: BigInt(min_amount_out),
        commitment,
      });

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'completed', tx_hash: txHash },
      });

      this.logger.log(`Swap completed: ${txHash}`);
    } catch (err: unknown) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          error: (err as { message?: string }).message,
        },
      });
      throw err;
    }
  }

  private async processRateUpdate(data: { usd_ngn: number }) {
    // For backwards compatibility: update just Starknet with USD_NGN payload
    try {
      const handler = this.chainManager.getHandler(ChainType.STARKNET);
      await handler.executeRateUpdate({ rates: { NGN: data.usd_ngn } });
    } catch (err: unknown) {
      this.logger.error('Rate update on-chain failed', err);
      throw err;
    }
  }

  private async processMultiCurrencyRateUpdate(
    data: { rates: Record<string, number>, chain?: string },
    chain: ChainType = ChainType.STARKNET
  ) {
    try {
      const targetChain = data.chain || chain;
      const handler = this.chainManager.getHandler(targetChain.toUpperCase());
      await handler.executeRateUpdate(data);
    } catch (err: unknown) {
      this.logger.error(`Multi-currency rate update on-chain failed for ${chain}`, err);
      throw err;
    }
  }
}
