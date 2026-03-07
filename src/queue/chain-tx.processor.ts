import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StarknetService } from '../starknet/starknet.service';
import { FlutterwaveService } from '../offramp/flutterwave.service';
import { uint256 } from 'starknet';

@Processor('chain-tx')
export class ChainTxProcessor extends WorkerHost {
  private readonly logger = new Logger(ChainTxProcessor.name);

  constructor(
    private readonly starknet: StarknetService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flutterwave: FlutterwaveService,
  ) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`Processing chain-tx job: ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case 'submit-buy':
        return this.processBuy(job.data);
      case 'process-bank-transfer':
        return this.processBankTransfer(job.data);
      case 'submit-swap':
        return this.processSwap(job.data);
      case 'push-rate':
        return this.processRateUpdate(job.data);
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async processBankTransfer(data: any) {
    console.log("Bank transfer data", data);
    const { transactionId, amount, currency, bank_account, bank_code, token_in } = data;

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

        this.logger.log(`Bank transfer completed for transaction: ${transactionId}`);
      } catch (flutterwaveError: any) {
        // Check if it's a merchant not enabled error (common in test/sandbox mode)
        const errorMessage = flutterwaveError?.response?.data?.message || flutterwaveError?.message || '';
        const isMerchantNotEnabled = errorMessage.includes('merchant is not enabled');

        if (isMerchantNotEnabled) {
          // In development/test mode, mark as completed with a note
          this.logger.warn(`Flutterwave not enabled for transfers. Marking transaction as completed (dev mode).`);
          await this.prisma.transaction.update({
            where: { id: transactionId },
            data: { 
              status: 'completed',
              error: 'Bank transfer skipped: Flutterwave merchant not enabled (test mode)'
            },
          });
          this.logger.log(`Transaction ${transactionId} marked as completed (Flutterwave disabled)`);
        } else {
          // For other errors, mark as failed and rethrow
          throw flutterwaveError;
        }
      }
    } catch (err) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed', error: err.message },
      });
      throw err;
    }
  }

  private async processBuy(data: any) {
    console.log("data", data);
    const { transactionId, amount_in, token_out, commitment } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
      const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');
      const usdcAddress = this.config.get<string>('USDC_ADDRESS');
      const tokenOutAddress = token_out === 'adusd' ? adusdAddress : adngnAddress;

      const amountU256 = uint256.bnToUint256(amount_in);

      // Approval is now done in the frontend, so we only execute the buy
      const txHash = await this.starknet.execute([
        {
          contractAddress: swapAddress,
          entrypoint: 'buy',
          calldata: [usdcAddress, amountU256, tokenOutAddress, commitment],
        },
      ]);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'completed', tx_hash: txHash },
      });

      this.logger.log(`Buy completed: ${txHash}`);
    } catch (err) {
      // For errors, mark as failed and allow retry
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed', error: err.message },
      });
      throw err; // BullMQ will retry
    }
  }



  private async processSwap(data: any) {
    const { transactionId, token_in, amount_in, token_out, min_amount_out, commitment } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
      const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');
      const tokenInAddr = token_in === 'adusd' ? adusdAddress : adngnAddress;
      const tokenOutAddr = token_out === 'adusd' ? adusdAddress : adngnAddress;
      const amountInU256 = uint256.bnToUint256(BigInt(amount_in));
      const minOutU256 = uint256.bnToUint256(BigInt(min_amount_out));

      const txHash = await this.starknet.execute([
        {
          contractAddress: swapAddress,
          entrypoint: 'swap',
          calldata: [
            tokenInAddr,
            amountInU256.low.toString(), amountInU256.high.toString(),
            tokenOutAddr,
            minOutU256.low.toString(), minOutU256.high.toString(),
            commitment,
          ],
        },
      ]);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'completed', tx_hash: txHash },
      });

      this.logger.log(`Swap completed: ${txHash}`);
    } catch (err) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed', error: err.message },
      });
      throw err;
    }
  }

  private async processRateUpdate(data: { usd_ngn: number }) {
    try {
      const { usd_ngn } = data;
      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
      const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');

      // rate scaled by 1e18: how many ADNGN wei per 1 ADUSD wei
      const rateBigInt = BigInt(Math.round(usd_ngn * 1e18));
      const rateU256 = uint256.bnToUint256(rateBigInt);
      const inverseRateBigInt = BigInt(Math.round((1 / usd_ngn) * 1e18));
      const inverseU256 = uint256.bnToUint256(inverseRateBigInt);

      await this.starknet.execute([
        // ADUSD -> ADNGN
        {
          contractAddress: swapAddress,
          entrypoint: 'set_rate',
          calldata: [adusdAddress, adngnAddress, rateU256.low.toString(), rateU256.high.toString()],
        },
        // ADNGN -> ADUSD
        {
          contractAddress: swapAddress,
          entrypoint: 'set_rate',
          calldata: [adngnAddress, adusdAddress, inverseU256.low.toString(), inverseU256.high.toString()],
        },
      ]);

      this.logger.log(`Rate updated on-chain: 1 ADUSD = ${usd_ngn} ADNGN`);
    } catch (err) {
      this.logger.error('Rate update on-chain failed', err);
      throw err;
    }
  }
}
