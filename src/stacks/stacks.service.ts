import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IChainProvider,
  ExecuteTransactionDto,
} from '../common/interfaces/chain-provider.interface';
import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from '@stacks/network';
import {
  makeContractCall,
  broadcastTransaction,
  ClarityValue,
} from '@stacks/transactions';

@Injectable()
export class StacksService implements IChainProvider {
  private readonly logger = new Logger(StacksService.name);
  private readonly network: StacksNetwork;
  private readonly deployerKey: string | null;

  constructor(private readonly config: ConfigService) {
    const isMainnet = this.config.get<string>('STACKS_NETWORK') === 'mainnet';
    this.network = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;
    const customApiBaseUrl = this.config.get<string>('STACKS_API_URL');
    if (customApiBaseUrl) {
      this.network.client.baseUrl = customApiBaseUrl;
    }
    this.deployerKey = this.config.get<string>('STACKS_DEPLOYER_PRIVATE_KEY') || null;
  }

  async checkHealth(): Promise<{ healthy: boolean; blockNumber?: number; error?: string }> {
    try {
      const resp = await fetch(`${this.network.client.baseUrl}/v2/info`);
      if (!resp.ok) throw new Error('Failed to fetch info');
      const data = await resp.json() as { stacks_tip_height: number };
      return { healthy: true, blockNumber: data.stacks_tip_height };
    } catch (err: unknown) {
      return { healthy: false, error: (err as Error).message };
    }
  }

  async getBalance(tokenAddress: string, accountAddress: string): Promise<bigint> {
    try {
      const resp = await fetch(
        `${this.network.client.baseUrl}/extended/v1/address/${accountAddress}/balances`,
      );
      const data = (await resp.json()) as any;

      if (tokenAddress === 'native') {
        return BigInt(data.stx.balance);
      }

      // For SIP-010 Tokens (ADKES, ADGHS, ADZAR, etc.)
      // The key in Hiro FT balances is "ADDRESS.CONTRACT::TOKEN_NAME"
      // Our contracts use 'adam-token' as the defined fungible token name
      const ftKey = `${tokenAddress}::adam-token`;
      const ftBalance = data.fungible_tokens?.[ftKey];

      if (ftBalance) {
        return BigInt(ftBalance.balance);
      }

      return 0n;
    } catch (err) {
      this.logger.error(
        `Failed to get balance for ${accountAddress} / ${tokenAddress}`,
        err,
      );
      return 0n;
    }
  }

  async executeTransaction(payload: ExecuteTransactionDto): Promise<string> {
    if (!this.deployerKey) {
      throw new Error('Stacks deployer private key not configured');
    }

    const [contractAddress, contractName] = payload.contractAddress.split('.');

    const txOptions = {
      contractAddress,
      contractName,
      functionName: payload.functionName,
      functionArgs: payload.calldata as unknown as ClarityValue[],
      senderKey: this.deployerKey,
      validateWithAbi: true,
      network: this.network,
    };

    try {
      const transaction = await makeContractCall(txOptions);
      const broadcastResponse = await broadcastTransaction({ transaction, network: this.network });
      
      if ('error' in broadcastResponse) {
         throw new Error(`Broadcast failed: ${broadcastResponse.error}`);
      }
      return broadcastResponse.txid;
    } catch (error) {
      this.logger.error('Stacks transaction execution failed', error);
      throw error;
    }
  }

  normalizeAddress(address: string): string {
    return address; 
  }
}
