import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StarknetService } from './starknet.service';
import { IChainHandler, RateUpdatePayload } from '../queue/chain-handler.interface';
import { uint256 } from 'starknet';

@Injectable()
export class StarknetChainHandler implements IChainHandler {
  public chainType = 'STARKNET';
  private readonly logger = new Logger(StarknetChainHandler.name);

  constructor(
    private readonly starknet: StarknetService,
    private readonly config: ConfigService,
  ) {}

  async executeBuy(data: {
    transactionId: string;
    amountIn: bigint;
    tokenOutAddress: string;
    commitment: string;
  }): Promise<string> {
    const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
    const usdcAddress = this.config.get<string>('USDC_ADDRESS');

    if (!swapAddress || !usdcAddress) {
      throw new Error('Missing Starknet swap or USDC configuration');
    }

    const amountU256 = uint256.bnToUint256(data.amountIn);

    const txHash = await this.starknet.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'buy',
        calldata: [
          usdcAddress,
          amountU256.low.toString(),
          amountU256.high.toString(),
          data.tokenOutAddress,
          data.commitment,
        ],
      },
    ]);

    return txHash;
  }

  async executeSwap(data: {
    transactionId: string;
    tokenInAddress: string;
    amountIn: bigint;
    tokenOutAddress: string;
    minAmountOut: bigint;
    commitment: string;
  }): Promise<string> {
    const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');

    if (!swapAddress) {
      throw new Error('Missing Starknet swap configuration');
    }

    const amountInU256 = uint256.bnToUint256(data.amountIn);
    const minOutU256 = uint256.bnToUint256(data.minAmountOut);

    const txHash = await this.starknet.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'swap',
        calldata: [
          data.tokenInAddress,
          amountInU256.low.toString(),
          amountInU256.high.toString(),
          data.tokenOutAddress,
          minOutU256.low.toString(),
          minOutU256.high.toString(),
          data.commitment,
        ],
      },
    ]);

    return txHash;
  }

  async executeRateUpdate(data: RateUpdatePayload): Promise<void> {
    const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
    const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');

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

    for (const [currency, rate] of Object.entries(data.rates)) {
      if (currency === 'USD') continue; // 1:1, usually don't need to push USD:USD rate

      const tokenAddress = tokenAddresses[currency];
      if (!tokenAddress) {
        this.logger.warn(`No token address configured for ${currency}`);
        continue;
      }

      const rateBigInt = BigInt(Math.round(rate * 1e18));
      const rateU256 = uint256.bnToUint256(rateBigInt);
      const inverseRateBigInt = BigInt(Math.round((1 / rate) * 1e18));
      const inverseU256 = uint256.bnToUint256(inverseRateBigInt);

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
        `Multi-currency rates updated on-chain for ${Object.keys(data.rates).join(', ')}`,
      );
    }
  }
}
