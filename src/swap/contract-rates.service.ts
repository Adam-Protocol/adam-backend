import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcProvider, uint256 } from 'starknet';

interface ContractRate {
    rate: number;
    source: 'contract';
    fetched_at: Date;
}

@Injectable()
export class ContractRatesService {
    private readonly logger = new Logger(ContractRatesService.name);
    private rpcProvider: RpcProvider;
    private cachedRates: Map<string, ContractRate> = new Map();
    private lastFetchTime: Date | null = null;

    constructor(private readonly config: ConfigService) {
        const rpcUrl = this.config.get<string>('STARKNET_RPC_URL');
        if (!rpcUrl) {
            throw new Error('STARKNET_RPC_URL not configured');
        }
        this.rpcProvider = new RpcProvider({ nodeUrl: rpcUrl });
    }

    /**
     * Fetch exchange rate from Starknet contract
     * @param tokenFrom Source token address
     * @param tokenTo Destination token address
     * @returns Rate as a number (scaled by 1e18 in contract, returned as decimal)
     */
    async getRate(tokenFrom: string, tokenTo: string): Promise<number> {
        try {
            const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
            if (!swapAddress) {
                throw new Error('ADAM_SWAP_ADDRESS not configured');
            }

            // Call get_rate on the swap contract
            const result = await this.rpcProvider.callContract({
                contractAddress: swapAddress,
                entrypoint: 'get_rate',
                calldata: [tokenFrom, tokenTo],
            });

            if (!result || result.length === 0) {
                throw new Error(`No rate returned from contract for ${tokenFrom} -> ${tokenTo}`);
            }

            // Result is a u256 (two felt252 values: low and high)
            // Convert back to number
            const rateBigInt = uint256.uint256ToBN({
                low: result[0],
                high: result[1],
            });

            // Rate is stored as 1e18 precision in contract
            const rate = Number(rateBigInt) / 1e18;

            // Cache the rate
            const cacheKey = `${tokenFrom}-${tokenTo}`;
            this.cachedRates.set(cacheKey, {
                rate,
                source: 'contract',
                fetched_at: new Date(),
            });

            this.logger.debug(
                `Fetched rate from contract: ${tokenFrom} -> ${tokenTo} = ${rate}`,
            );

            return rate;
        } catch (error) {
            this.logger.error(
                `Failed to fetch rate from contract for ${tokenFrom} -> ${tokenTo}:`,
                error,
            );
            throw error;
        }
    }

    /**
     * Get all rates for a currency from contract
     * @param currency Currency code (NGN, KES, GHS, ZAR)
     * @returns Object with forward and inverse rates
     */
    async getCurrencyRates(currency: string): Promise<{
        forward: number;
        inverse: number;
    }> {
        const adusdAddress = this.config.get<string>('ADUSD_ADDRESS');
        const tokenAddress = this.config.get<string>(`AD${currency}_ADDRESS`);

        if (!adusdAddress || !tokenAddress) {
            throw new Error(
                `Missing addresses for currency ${currency}. Ensure ADUSD_ADDRESS and AD${currency}_ADDRESS are configured.`,
            );
        }

        const forward = await this.getRate(adusdAddress, tokenAddress);
        const inverse = await this.getRate(tokenAddress, adusdAddress);

        return { forward, inverse };
    }

    /**
     * Get cached rate if available
     * @param tokenFrom Source token address
     * @param tokenTo Destination token address
     * @returns Cached rate or null if not cached
     */
    getCachedRate(tokenFrom: string, tokenTo: string): number | null {
        const cacheKey = `${tokenFrom}-${tokenTo}`;
        const cached = this.cachedRates.get(cacheKey);
        return cached ? cached.rate : null;
    }

    /**
     * Clear all cached rates
     */
    clearCache(): void {
        this.cachedRates.clear();
        this.lastFetchTime = null;
        this.logger.log('Contract rates cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        cachedPairs: number;
        lastFetchTime: Date | null;
    } {
        return {
            cachedPairs: this.cachedRates.size,
            lastFetchTime: this.lastFetchTime,
        };
    }
}
