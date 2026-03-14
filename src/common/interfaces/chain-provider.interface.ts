export interface ExecuteTransactionDto {
  contractAddress: string;
  /** Chain-neutral name for the function/entrypoint to call */
  functionName: string;
  calldata: any[];
}

export interface IChainProvider {
  /** Check if the RPC is healthy */
  checkHealth(): Promise<{
    healthy: boolean;
    blockNumber?: number;
    error?: string;
  }>;

  /** Get native or ERC20/SIP10 balance */
  getBalance(tokenAddress: string, accountAddress: string): Promise<bigint>;

  /** Execute a transaction natively */
  executeTransaction(payload: ExecuteTransactionDto): Promise<string>;

  /** Normalize an address string to its standard format */
  normalizeAddress(address: string): string;
}
