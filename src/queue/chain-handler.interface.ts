export interface RateUpdatePayload {
  rates: Record<string, number>;
}

export interface IChainHandler {
  chainType: string;

  /**
   * Execute a buy transaction
   */
  executeBuy(data: {
    transactionId: string;
    amountIn: bigint;
    tokenOutAddress: string;
    commitment: string;
  }): Promise<string>;

  /**
   * Execute a swap transaction
   */
  executeSwap(data: {
    transactionId: string;
    tokenInAddress: string;
    amountIn: bigint;
    tokenOutAddress: string;
    minAmountOut: bigint;
    commitment: string;
  }): Promise<string>;

  /**
   * Execute currency rate updates 
   */
  executeRateUpdate(data: RateUpdatePayload): Promise<void>;
}
