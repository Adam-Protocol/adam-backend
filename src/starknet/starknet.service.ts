import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Account, Contract, RpcProvider, uint256, constants } from 'starknet';
import {
  IChainProvider,
  ExecuteTransactionDto,
} from '../common/interfaces/chain-provider.interface';

@Injectable()
export class StarknetService implements IChainProvider {
  private readonly logger = new Logger(StarknetService.name);
  private readonly provider: RpcProvider;
  private readonly account: Account | null;

  constructor(private readonly config: ConfigService) {
    // Create RPC provider with specific configuration for Alchemy
    const chainIdConfig = this.config.get<string>('STARKNET_CHAIN_ID');
    this.provider = new RpcProvider({
      nodeUrl: this.config.get<string>('STARKNET_RPC_URL')!,
      // Use proper StarknetChainId constant
      chainId:
        chainIdConfig === 'SN_SEPOLIA'
          ? constants.StarknetChainId.SN_SEPOLIA
          : undefined,
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
      this.account = new Account({
        provider: this.provider,
        address: deployerAddress,
        signer: deployerPrivateKey,
      });
    } else {
      this.account = null;
      this.logger.warn(
        'Starknet credentials not configured. Some operations will be unavailable.',
      );
    }
  }

  get rpcProvider() {
    return this.provider;
  }

  get deployerAccount() {
    if (!this.account) {
      throw new Error(
        'Starknet account not configured. Set DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY in .env',
      );
    }
    return this.account;
  }

  /** Load a contract ABI by address */
  async getContract(address: string): Promise<Contract> {
    const { abi } = await this.provider.getClassAt(address);
    return new Contract({
      abi,
      address,
      providerOrAccount: this.deployerAccount,
    });
  }

  /**
   * Execute a single transaction (IChainProvider implementation)
   */
  async executeTransaction(payload: ExecuteTransactionDto): Promise<string> {
    return this.execute([
      {
        contractAddress: payload.contractAddress,
        entrypoint: payload.functionName,
        calldata: payload.calldata as string[],
      },
    ]);
  }

  /**
   * Submit a transaction and return the tx hash.
   * Used by the queue processors.
   */
  async execute(
    calls: Array<{
      contractAddress: string;
      entrypoint: string;
      calldata: string[];
    }>,
  ): Promise<string> {
    try {
      // Execute transaction with proper v9.2.1 signature
      const { transaction_hash } = await this.deployerAccount.execute(calls);

      await this.provider.waitForTransaction(transaction_hash);
      return transaction_hash;
    } catch (error) {
      // this.logger.error('Transaction execution failed', error);
      throw error?.baseError?.message;
    }
  }

  /** Normalize an address string to its standard format */
  normalizeAddress(address: string): string {
    // Basic formatting: lowercased, ensures 0x prefix. More strict normalization could use Starknet core utils.
    return address.toLowerCase().startsWith('0x')
      ? address.toLowerCase()
      : `0x${address.toLowerCase()}`;
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
  async checkHealth(): Promise<{
    healthy: boolean;
    blockNumber?: number;
    error?: string;
  }> {
    try {
      const block = await this.provider.getBlock('latest');
      return {
        healthy: true,
        blockNumber: Number(block.block_number),
      };
    } catch (error: unknown) {
      this.logger.error('RPC health check failed', error);
      return {
        healthy: false,
        error: (error as { message?: string }).message,
      };
    }
  }

  /** Get account balance */
  async getBalance(
    tokenAddress: string,
    accountAddress: string,
  ): Promise<bigint> {
    try {
      // Use provider for read-only operations
      const { abi } = await this.provider.getClassAt(tokenAddress);
      const contract = new Contract({
        abi,
        address: tokenAddress,
        providerOrAccount: this.provider,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = (await contract.balance_of(accountAddress)) as
        | bigint
        | { balance?: { low: bigint; high: bigint } | [bigint, bigint] }
        | { low: bigint; high: bigint }
        | [bigint, bigint];

      // If result is already a BigInt, return it directly
      if (typeof result === 'bigint') {
        return result;
      }

      // Handle u256 struct response
      const balance =
        'balance' in result && result.balance ? result.balance : result;

      let lowValue: bigint;
      let highValue: bigint;

      if (Array.isArray(balance)) {
        lowValue = balance[0];
        highValue = balance[1];
      } else if ('low' in balance && 'high' in balance) {
        lowValue = balance.low;
        highValue = balance.high;
      } else {
        // Fallback to 0 if structure is unexpected
        lowValue = 0n;
        highValue = 0n;
      }

      const low = BigInt(lowValue || 0);
      const high = BigInt(highValue || 0);

      return low + (high << 128n);
    } catch (error) {
      this.logger.error(`Failed to get balance for ${accountAddress}`, error);
      throw error;
    }
  }
}
