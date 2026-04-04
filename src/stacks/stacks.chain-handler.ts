import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StacksService } from './stacks.service';
import { IChainHandler, RateUpdatePayload } from '../queue/chain-handler.interface';
import { uintCV, contractPrincipalCV, principalCV } from '@stacks/transactions';

@Injectable()
export class StacksChainHandler implements IChainHandler {
  public chainType = 'STACKS';
  private readonly logger = new Logger(StacksChainHandler.name);

  constructor(
    private readonly stacks: StacksService,
    private readonly config: ConfigService,
  ) { }

  async executeBuy(data: {
    transactionId: string;
    amountIn: bigint;
    tokenOutAddress: string;
    commitment: string;
  }): Promise<string> {
    const swapContractId = this.config.get<string>('STACKS_ADAM_SWAP_ADDRESS');

    if (!swapContractId) {
      throw new Error('Missing Stacks swap contract configuration');
    }

    // Backend Stacks Buy execution 
    // Currently Stacks doesn't need a separate approval, execution happens on frontend mostly
    // But if we need to process it on backend here is the stub
    const txid = await this.stacks.executeTransaction({
      contractAddress: swapContractId,
      functionName: 'buy',
      calldata: [
        uintCV(data.amountIn.toString()),
        contractPrincipalCV(data.tokenOutAddress.split('.')[0], data.tokenOutAddress.split('.')[1]),
      ],
    });

    return txid;
  }

  async executeSwap(data: {
    transactionId: string;
    tokenInAddress: string;
    amountIn: bigint;
    tokenOutAddress: string;
    minAmountOut: bigint;
    commitment: string;
  }): Promise<string> {
    const swapContractId = this.config.get<string>('STACKS_ADAM_SWAP_ADDRESS');

    if (!swapContractId) {
      throw new Error('Missing Stacks swap contract configuration');
    }

    const txid = await this.stacks.executeTransaction({
      contractAddress: swapContractId,
      functionName: 'swap',
      calldata: [
        contractPrincipalCV(data.tokenInAddress.split('.')[0], data.tokenInAddress.split('.')[1]),
        uintCV(data.amountIn.toString()),
        contractPrincipalCV(data.tokenOutAddress.split('.')[0], data.tokenOutAddress.split('.')[1]),
        uintCV(data.minAmountOut.toString()),
      ],
    });

    return txid;
  }

  async executeRateUpdate(data: RateUpdatePayload): Promise<void> {
    const swapContractId = this.config.get<string>('STACKS_ADAM_SWAP_ADDRESS');
    const deployerAddress = this.config.get<string>('STACKS_DEPLOYER_ADDRESS');

    if (!swapContractId || !deployerAddress) {
      this.logger.error('Stacks contract configuration missing');
      throw new Error('Stacks contract configuration missing');
    }

    const tokenContracts: Record<string, string> = {
      USD: 'adam-token-adusd-v3',
      NGN: 'adam-token-adngn-v3',
      KES: 'adam-token-adkes-v3',
      GHS: 'adam-token-adghs-v3',
      ZAR: 'adam-token-adzar-v3',
    };

    const usdcContract = 'usdcx-v3';
    const adusdContract = tokenContracts.USD;

    const convertRate = (rate: number): string => {
      return Math.round(rate * 1e6).toString();
    };

    const rateCalls: Array<{
      from: string;
      to: string;
      rate: string;
      label: string;
    }> = [];

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

    for (const [currency, rate] of Object.entries(data.rates)) {
      if (currency === 'USD') continue;

      const tokenContract = tokenContracts[currency];
      if (!tokenContract) {
        this.logger.warn(`No token contract configured for ${currency}`);
        continue;
      }

      const forwardRate = convertRate(rate);
      const inverseRate = convertRate(1 / rate);

      rateCalls.push(
        { from: usdcContract, to: tokenContract, rate: forwardRate, label: `USDC → AD${currency}` },
        { from: tokenContract, to: usdcContract, rate: inverseRate, label: `AD${currency} → USDC` },
        { from: adusdContract, to: tokenContract, rate: forwardRate, label: `ADUSD → AD${currency}` },
        { from: tokenContract, to: adusdContract, rate: inverseRate, label: `AD${currency} → ADUSD` },
      );
    }

    let currentNonce: number | undefined = undefined;
    if (deployerAddress) {
      currentNonce = await this.stacks.getNextNonce(deployerAddress);
    }

    for (const call of rateCalls) {
      try {
        // Create contract principals for the token contracts
        const fromPrincipal = contractPrincipalCV(deployerAddress, call.from);
        const toPrincipal = contractPrincipalCV(deployerAddress, call.to);

        const txid = await this.stacks.executeTransaction({
          contractAddress: swapContractId,
          functionName: 'set-rate',
          calldata: [
            fromPrincipal,
            toPrincipal,
            uintCV(call.rate),
          ],
          nonce: currentNonce,
        });

        if (currentNonce !== undefined) {
          currentNonce++;
        }

        this.logger.log(`${call.label}: ${call.rate} (txid: ${txid})`);
      } catch (error) {
        this.logger.error(`Failed to set rate ${call.label}:`, error);
      }
    }

    this.logger.log(`Stacks rates updated for ${Object.keys(data.rates).join(', ')}`);
  }
}
