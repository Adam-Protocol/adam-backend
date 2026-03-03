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
    this.provider = new RpcProvider({
      nodeUrl: this.config.get<string>('STARKNET_RPC_URL')!,
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
      this.account = new Account(this.provider, deployerAddress, deployerPrivateKey);
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
    const { transaction_hash } = await this.deployerAccount.execute(calls);
    await this.provider.waitForTransaction(transaction_hash);
    return transaction_hash;
  }

  /** Convert a u256 amount to a pair of felts for contract calls */
  toUint256(amount: bigint): { low: string; high: string } {
    const u256 = uint256.bnToUint256(amount);
    return {
      low: u256.low.toString(),
      high: u256.high.toString(),
    };
  }
}
