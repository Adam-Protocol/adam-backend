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
      case 'submit-sell':
        return this.processSell(job.data);
      case 'submit-swap':
        return this.processSwap(job.data);
      case 'push-rate':
        return this.processRateUpdate(job.data);
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async processBuy(data: any) {
    const { transactionId, wallet, amount_in, token_out, commitment } = data;

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

      const amountU256 = uint256.bnToUint256(BigInt(amount_in));

      const txHash = await this.starknet.execute([
        // First approve USDC spend
        {
          contractAddress: usdcAddress,
          entrypoint: 'approve',
          calldata: [swapAddress, amountU256.low, amountU256.high],
        },
        // Then buy
        {
          contractAddress: swapAddress,
          entrypoint: 'buy',
          calldata: [usdcAddress, amountU256.low, amountU256.high, tokenOutAddress, commitment],
        },
      ]);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'completed', tx_hash: txHash },
      });

      this.logger.log(`Buy completed: ${txHash}`);
    } catch (err) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed', error: err.message },
      });
      throw err; // BullMQ will retry
    }
  }

  private async processSell(data: any) {
    const { transactionId, wallet, token_in, amount, nullifier, commitment } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
      const adngnAddress = this.config.get<string>('ADNGN_ADDRESS');
      const tokenInAddress = token_in === 'adusd' ? adusdAddress : adngnAddress;
      const amountU256 = uint256.bnToUint256(BigInt(amount));

      const txHash = await this.starknet.execute([
        {
          contractAddress: swapAddress,
          entrypoint: 'sell',
          calldata: [tokenInAddress, amountU256.low, amountU256.high, nullifier, commitment],
        },
      ]);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { tx_hash: txHash },
      });

      // Trigger bank transfer via Flutterwave
      const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
      if (tx?.bank_account && tx?.bank_code) {
        await this.flutterwave.initiateBankTransfer({
          transactionId,
          amount: Number(amount) / 1e18, // assumes 18 decimals
          currency: tx.currency ?? 'NGN',
          bank_account: tx.bank_account,
          bank_code: tx.bank_code,
          narration: `Adam Protocol offramp - ${tx.token_in}`,
        });
      }

      this.logger.log(`Sell completed: ${txHash}`);
    } catch (err) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed', error: err.message },
      });
      throw err;
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
            amountInU256.low, amountInU256.high,
            tokenOutAddr,
            minOutU256.low, minOutU256.high,
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
          calldata: [adusdAddress, adngnAddress, rateU256.low, rateU256.high],
        },
        // ADNGN -> ADUSD
        {
          contractAddress: swapAddress,
          entrypoint: 'set_rate',
          calldata: [adngnAddress, adusdAddress, inverseU256.low, inverseU256.high],
        },
      ]);

      this.logger.log(`Rate updated on-chain: 1 ADUSD = ${usd_ngn} ADNGN`);
    } catch (err) {
      this.logger.error('Rate update on-chain failed', err);
      throw err;
    }
  }
}
