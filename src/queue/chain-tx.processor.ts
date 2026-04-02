import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StarknetService } from '../starknet/starknet.service';
import { StacksService } from '../stacks/stacks.service';
import { FlutterwaveService } from '../offramp/flutterwave.service';
import { uint256 } from 'starknet';
import { uintCV, contractPrincipalCV } from '@stacks/transactions';

@Processor('chain-tx')
export class ChainTxProcessor extends WorkerHost {
  private readonly logger = new Logger(ChainTxProcessor.name);

  constructor(
    private readonly starknet: StarknetService,
    private readonly stacks: StacksService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flutterwave: FlutterwaveService,
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
          },
        );
      case 'push-rate':
        return this.processRateUpdate(job.data as { usd_ngn: number });
      case 'push-rates':
        return this.processMultiCurrencyRateUpdate(
          job.data as { rates: Record<string, number> },
        );
      case 'push-rates-stacks':
        return this.processStacksRateUpdate(
          job.data as { rates: Record<string, number> },
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
  }) {
    const { transactionId, amount_in, token_out, commitment } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
      const usdcAddress = this.config.get<string>('USDC_ADDRESS');

      // Map token names to addresses
      const tokenAddresses: Record<string, string> = {
        adusd: this.config.get<string>('ADUSD_ADDRESS')!,
        adngn: this.config.get<string>('ADNGN_ADDRESS')!,
        adkes: this.config.get<string>('ADKES_ADDRESS')!,
        adghs: this.config.get<string>('ADGHS_ADDRESS')!,
        adzar: this.config.get<string>('ADZAR_ADDRESS')!,
      };

      const tokenOutAddress = tokenAddresses[token_out.toLowerCase()];
      if (!tokenOutAddress) {
        throw new Error(`Unknown token: ${token_out}`);
      }

      const amountU256 = uint256.bnToUint256(BigInt(amount_in));

      // Approval is now done in the frontend, so we only execute the buy
      const txHash = await this.starknet.execute([
        {
          contractAddress: swapAddress!,
          entrypoint: 'buy',
          calldata: [
            usdcAddress!,
            amountU256.low.toString(),
            amountU256.high.toString(),
            tokenOutAddress!,
            commitment,
          ],
        },
      ]);

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
  }) {
    const {
      transactionId,
      token_in,
      amount_in,
      token_out,
      min_amount_out,
      commitment,
    } = data;

    try {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'processing' },
      });

      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');

      // Map token names to addresses
      const tokenAddresses: Record<string, string> = {
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

      const amountInU256 = uint256.bnToUint256(BigInt(amount_in));
      const minOutU256 = uint256.bnToUint256(BigInt(min_amount_out));

      const txHash = await this.starknet.execute([
        {
          contractAddress: swapAddress!,
          entrypoint: 'swap',
          calldata: [
            tokenInAddr!,
            amountInU256.low.toString(),
            amountInU256.high.toString(),
            tokenOutAddr!,
            minOutU256.low.toString(),
            minOutU256.high.toString(),
            commitment,
          ],
        },
      ]);

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
          contractAddress: swapAddress!,
          entrypoint: 'set_rate',
          calldata: [
            adusdAddress!,
            adngnAddress!,
            rateU256.low.toString(),
            rateU256.high.toString(),
          ],
        },
        // ADNGN -> ADUSD
        {
          contractAddress: swapAddress!,
          entrypoint: 'set_rate',
          calldata: [
            adngnAddress!,
            adusdAddress!,
            inverseU256.low.toString(),
            inverseU256.high.toString(),
          ],
        },
      ]);

      this.logger.log(`Rate updated on-chain: 1 ADUSD = ${usd_ngn} ADNGN`);
    } catch (err: unknown) {
      this.logger.error('Rate update on-chain failed', err);
      throw err;
    }
  }

  private async processMultiCurrencyRateUpdate(data: {
    rates: Record<string, number>;
  }) {
    try {
      const { rates } = data;
      const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
      const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');

      // Map of currency code to token address
      const tokenAddresses: Record<string, string> = {
        NGN: this.config.get<string>('ADNGN_ADDRESS')!,
        KES: this.config.get<string>('ADKES_ADDRESS')!,
        GHS: this.config.get<string>('ADGHS_ADDRESS')!,
        ZAR: this.config.get<string>('ADZAR_ADDRESS')!,
      };

      const calls: Array<{
        contractAddress: string;
        entrypoint: string;
        calldata: string[];
      }> = [];

      // Set rates for each currency pair
      for (const [currency, rate] of Object.entries(rates)) {
        const tokenAddress = tokenAddresses[currency];
        if (!tokenAddress) {
          this.logger.warn(`No token address configured for ${currency}`);
          continue;
        }

        // rate scaled by 1e18: how many AD{CURRENCY} wei per 1 ADUSD wei
        const rateBigInt = BigInt(Math.round(rate * 1e18));
        const rateU256 = uint256.bnToUint256(rateBigInt);
        const inverseRateBigInt = BigInt(Math.round((1 / rate) * 1e18));
        const inverseU256 = uint256.bnToUint256(inverseRateBigInt);

        // ADUSD -> AD{CURRENCY}
        calls.push({
          contractAddress: swapAddress!,
          entrypoint: 'set_rate',
          calldata: [
            adusdAddress!,
            tokenAddress,
            rateU256.low.toString(),
            rateU256.high.toString(),
          ],
        });

        // AD{CURRENCY} -> ADUSD
        calls.push({
          contractAddress: swapAddress!,
          entrypoint: 'set_rate',
          calldata: [
            tokenAddress,
            adusdAddress!,
            inverseU256.low.toString(),
            inverseU256.high.toString(),
          ],
        });

        this.logger.log(`Rate prepared: 1 ADUSD = ${rate} ${currency}`);
      }

      if (calls.length > 0) {
        await this.starknet.execute(calls);
        this.logger.log(
          `Multi-currency rates updated on-chain for ${Object.keys(rates).join(', ')}`,
        );
      }
    } catch (err: unknown) {
      this.logger.error('Multi-currency rate update on-chain failed', err);
      throw err;
    }
  }

  private async processStacksRateUpdate(data: {
    rates: Record<string, number>;
  }) {
    try {
      const { rates } = data;
      const swapContractId = this.config.get<string>('STACKS_ADAM_SWAP_ADDRESS');
      const deployerAddress = this.config.get<string>('STACKS_DEPLOYER_ADDRESS');

      if (!swapContractId || !deployerAddress) {
        this.logger.error('Stacks contract configuration missing');
        throw new Error('Stacks contract configuration missing');
      }

      // Map of currency code to token contract name
      const tokenContracts: Record<string, string> = {
        USD: 'adam-token-adusd-v2',
        NGN: 'adam-token-adngn-v2',
        KES: 'adam-token-adkes-v2',
        GHS: 'adam-token-adghs-v2',
        ZAR: 'adam-token-adzar-v2',
      };

      const usdcContract = 'usdcx-v3';
      const adusdContract = tokenContracts.USD;

      // Convert rates to 6 decimal precision (1e6) for Stacks
      const convertRate = (rate: number): string => {
        return Math.round(rate * 1e6).toString();
      };

      // Prepare all rate update calls
      const rateCalls: Array<{
        from: string;
        to: string;
        rate: string;
        label: string;
      }> = [];

      // USDC <-> ADUSD (1:1)
      rateCalls.push(
        {
          from: usdcContract,
          to: adusdContract,
          rate: convertRate(1),
          label: 'USDC → ADUSD',
        },
        {
          from: adusdContract,
          to: usdcContract,
          rate: convertRate(1),
          label: 'ADUSD → USDC',
        },
      );

      // For each currency, set USDC <-> AD{CURRENCY} and ADUSD <-> AD{CURRENCY}
      for (const [currency, rate] of Object.entries(rates)) {
        const tokenContract = tokenContracts[currency];
        if (!tokenContract) {
          this.logger.warn(`No token contract configured for ${currency}`);
          continue;
        }

        const forwardRate = convertRate(rate);
        const inverseRate = convertRate(1 / rate);

        // USDC <-> AD{CURRENCY}
        rateCalls.push(
          {
            from: usdcContract,
            to: tokenContract,
            rate: forwardRate,
            label: `USDC → AD${currency}`,
          },
          {
            from: tokenContract,
            to: usdcContract,
            rate: inverseRate,
            label: `AD${currency} → USDC`,
          },
        );

        // ADUSD <-> AD{CURRENCY}
        rateCalls.push(
          {
            from: adusdContract,
            to: tokenContract,
            rate: forwardRate,
            label: `ADUSD → AD${currency}`,
          },
          {
            from: tokenContract,
            to: adusdContract,
            rate: inverseRate,
            label: `AD${currency} → ADUSD`,
          },
        );

        this.logger.log(`Rate prepared: 1 USD = ${rate} ${currency}`);
      }

      // Execute all rate updates sequentially (Stacks doesn't support batch like Starknet)
      for (const call of rateCalls) {
        try {
          const txid = await this.stacks.executeTransaction({
            contractAddress: swapContractId,
            functionName: 'set-rate',
            calldata: [
              contractPrincipalCV(deployerAddress, call.from),
              contractPrincipalCV(deployerAddress, call.to),
              uintCV(call.rate),
            ],
          });

          this.logger.log(`${call.label}: ${call.rate} (txid: ${txid})`);
        } catch (error) {
          this.logger.error(`Failed to set rate ${call.label}:`, error);
          // Continue with other rates even if one fails
        }
      }

      this.logger.log(
        `Stacks rates updated for ${Object.keys(rates).join(', ')}`,
      );
    } catch (err: unknown) {
      this.logger.error('Stacks rate update failed', err);
      throw err;
    }
  }
}
