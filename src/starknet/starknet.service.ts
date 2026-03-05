import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  Contract,
  RpcProvider,
  CallData,
  stark,
  hash,
  uint256,
  shortString,
} from 'starknet';

@Injectable()
export class StarknetService {
  private readonly logger = new Logger(StarknetService.name);
  private readonly provider: RpcProvider;
  private readonly account: Account | null;

  constructor(private readonly config: ConfigService) {
    // Create RPC provider with specific configuration for Alchemy
    this.provider = new RpcProvider({
      nodeUrl: this.config.get<string>('STARKNET_RPC_URL')!,
      // Specify chain ID to help with block identification
      chainId: this.config.get<string>('STARKNET_CHAIN_ID') || 'SN_SEPOLIA',
    });

    const deployerAddress = this.config.get<string>('DEPLOYER_ADDRESS');
    const deployerPrivateKey = this.config.get<string>('DEPLOYER_PRIVATE_KEY');

    // Only create account if credentials are properly configured
    if (
      deployerAddress &&
      deployerPrivateKey &&
      !deployerAddress.includes('...') &&
      !deployerPrivateKey.includes('...')
    ) {
      this.account = new Account(this.provider, deployerAddress, deployerPrivateKey, '1');
    } else {
      this.account = null;
      this.logger.warn('Starknet credentials not configured. Some operations will be unavailable.');
    }
  }

  get rpcProvider() {
    return this.provider;
  }

  get deployerAccount() {
    if (!this.account) {
      throw new Error('Starknet account not configured. Set DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY in .env');
    }
    return this.account;
  }

  /** Load a contract ABI by address */
  async getContract(address: string): Promise<Contract> {
    const { abi } = await this.provider.getClassAt(address);
    return new Contract(abi, address, this.deployerAccount);
  }

  /**
   * Submit a transaction and return the tx hash.
   * Used by the queue processors.
   */
  async execute(calls: any[]): Promise<string> {
    try {
      // Get nonce using "latest" block instead of "pending" to avoid Alchemy RPC issues
      const nonce = await this.deployerAccount.getNonce('latest');
      
      // Build the transaction with explicit nonce
      const { transaction_hash } = await this.deployerAccount.execute(
        calls,
        undefined,
        {
          nonce,
          maxFee: undefined, // Let starknet-js calculate max fee
        }
      );
      
      await this.provider.waitForTransaction(transaction_hash);
      return transaction_hash;
    } catch (error) {
      this.logger.error('Transaction execution failed', error);
      throw error;
    }
  }

  /** Convert a u256 amount to a pair of felts for contract calls */
  toUint256(amount: bigint): { low: string; high: string } {
    const u256 = uint256.bnToUint256(amount);
    return {
      low: u256.low.toString(),
      high: u256.high.toString(),
    };
  }

  /** Check RPC connection health */
  async checkHealth(): Promise<{ healthy: boolean; blockNumber?: number; error?: string }> {
    try {
      const block = await this.provider.getBlock('latest');
      return {
        healthy: true,
        blockNumber: Number(block.block_number),
      };
    } catch (error) {
      this.logger.error('RPC health check failed', error);
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /** Get account balance */
  async getBalance(tokenAddress: string, accountAddress: string): Promise<bigint> {
    try {
      const contract = await this.getContract(tokenAddress);
      const balance = await contract.balanceOf(accountAddress);
      return BigInt(balance.balance.low) + (BigInt(balance.balance.high) << 128n);
    } catch (error) {
      this.logger.error(`Failed to get balance for ${accountAddress}`, error);
      throw error;
    }
  }
}
