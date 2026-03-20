#!/usr/bin/env ts-node

/**
 * Test Rate Update System
 * 
 * This script tests the rate fetching and update mechanism
 * without actually pushing to the blockchain.
 * 
 * Usage: pnpm exec ts-node src/scripts/test-rate-update.ts
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface ExchangeRateResponse {
    conversion_rates: Record<string, number>;
}

const SUPPORTED_CURRENCIES = ['NGN', 'KES', 'GHS', 'ZAR'];

async function fetchFromExchangeRateApi(): Promise<Record<string, number>> {
    const key = process.env.EXCHANGE_RATE_API_KEY;
    const url = `${process.env.EXCHANGE_RATE_API_URL}/${key}/latest/USD`;

    console.log('📡 Fetching rates from ExchangeRate-API...\n');

    try {
        const { data } = await axios.get<ExchangeRateResponse>(url);

        const rates: Record<string, number> = {};
        for (const currency of SUPPORTED_CURRENCIES) {
            rates[currency] = data.conversion_rates[currency];
        }

        return rates;
    } catch (error) {
        console.error('❌ Failed to fetch rates:', error);
        throw error;
    }
}

function convertToStarknetPrecision(rate: number): string {
    // Starknet uses 1e18 precision
    const value = BigInt(Math.round(rate * 1e18));
    return value.toString();
}

function convertToStacksPrecision(rate: number): string {
    // Stacks uses 1e6 precision
    const value = Math.round(rate * 1e6);
    return value.toString();
}

async function main() {
    console.log('=========================================');
    console.log('🧪 Rate Update System Test');
    console.log('=========================================\n');

    // Fetch rates
    const rates = await fetchFromExchangeRateApi();

    console.log('✅ Rates fetched successfully!\n');
    console.log('=========================================');
    console.log('📊 Current Exchange Rates');
    console.log('=========================================\n');

    for (const [currency, rate] of Object.entries(rates)) {
        console.log(`${currency}:`);
        console.log(`  Raw Rate: 1 USD = ${rate} ${currency}`);
        console.log(`  Inverse: 1 ${currency} = ${(1 / rate).toFixed(8)} USD`);
        console.log(`  Starknet (1e18): ${convertToStarknetPrecision(rate)}`);
        console.log(`  Stacks (1e6): ${convertToStacksPrecision(rate)}`);
        console.log('');
    }

    console.log('=========================================');
    console.log('📝 Stacks .env Format');
    console.log('=========================================\n');

    for (const [currency, rate] of Object.entries(rates)) {
        const token = `AD${currency}`;
        const forwardRate = convertToStacksPrecision(rate);
        const inverseRate = convertToStacksPrecision(1 / rate);

        console.log(`# USDC <-> ${token} (1 USDC = ${rate} ${token})`);
        console.log(`RATE_USDC_${token}="${forwardRate}"`);
        console.log(`RATE_${token}_USDC="${inverseRate}"`);
        console.log('');
    }

    console.log('=========================================');
    console.log('🎯 Rate Update Summary');
    console.log('=========================================\n');

    console.log('Total rate pairs to update:');
    console.log(`  - USDC ↔ ADUSD: 2 pairs`);
    console.log(`  - USDC ↔ Local currencies: ${SUPPORTED_CURRENCIES.length * 2} pairs`);
    console.log(`  - ADUSD ↔ Local currencies: ${SUPPORTED_CURRENCIES.length * 2} pairs`);
    console.log(`  - Total: ${2 + SUPPORTED_CURRENCIES.length * 4} pairs\n`);

    console.log('Chains to update:');
    console.log('  ✓ Starknet (via push-rates job)');
    console.log('  ✓ Stacks (via push-rates-stacks job)\n');

    console.log('=========================================');
    console.log('✅ Test Complete!');
    console.log('=========================================\n');

    console.log('Next steps:');
    console.log('1. Update adam-contract/stacks/.env with the values above');
    console.log('2. Ensure backend .env has correct API keys');
    console.log('3. Start backend: pnpm run start:dev');
    console.log('4. Rates will auto-update every 5 minutes\n');
}

main().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
