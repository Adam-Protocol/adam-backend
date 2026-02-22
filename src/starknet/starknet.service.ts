import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  Contract,
  RpcProvider,
  CallData,
  stark,
  hash,
  pedersen,
  uint256,
  shortString,
} from 'starknet';

@Injectable()
export class StarknetService {
  private readonly logger = new Logger(StarknetService.name);
  private readonly provider: RpcProvider;
  private readonly account: Account;

  constructor(private readonly config: ConfigService) {
    this.provider = new RpcProvider({
      nodeUrl: this.config.get<string>('STARKNET_RPC_URL'),
    });

    this.account = new Account(
      this.provider,
      this.config.get<string>('DEPLOYER_ADDRESS'),
      this.config.get<string>('DEPLOYER_PRIVATE_KEY'),
    );
  }

  get rpcProvider() {
    return this.provider;
  }

  get deployerAccount() {
    return this.account;
  }

  /** Load a contract ABI by address */
  async getContract(address: string): Promise<Contract> {
    const { abi } = await this.provider.getClassAt(address);
    return new Contract(abi, address, this.account);
  }

  /**
   * Submit a transaction and return the tx hash.
   * Used by the queue processors.
   */
  async execute(calls: any[]): Promise<string> {
    const { transaction_hash } = await this.account.execute(calls);
    await this.provider.waitForTransaction(transaction_hash);
    return transaction_hash;
  }

  /**
   * Compute Pedersen commitment client-side (for the backend commitment helper).
   * commitment = pedersen(amount_felt, secret_felt)
   */
  computeCommitment(amount: bigint, secret: bigint): string {
    return pedersen(amount.toString(), secret.toString());
  }

  /**
   * Compute nullifier.
   * nullifier = pedersen(secret_felt, nullifier_key_felt)
   */
  computeNullifier(secret: bigint, nullifierKey: bigint): string {
    return pedersen(secret.toString(), nullifierKey.toString());
  }

  /** Convert a u256 amount to a pair of felts for contract calls */
  toUint256(amount: bigint): { low: string; high: string } {
    return uint256.bnToUint256(amount);
  }
}
