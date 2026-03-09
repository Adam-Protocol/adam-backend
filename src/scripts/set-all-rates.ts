/**
 * Comprehensive script to set all currency rates on-chain
 * Sets rates for:
 * 1. USDC <-> All Adam tokens (accounting for decimal difference)
 * 2. ADUSD <-> All other Adam tokens (currency exchange rates)
 * 
 * Usage: npx ts-node src/scripts/set-all-rates.ts
 */

import { config } from 'dotenv';
import { Account, RpcProvider, uint256 } from 'starknet';

config();

interface CurrencyRate {
  currency: string;
  token: string;
  symbol: string;
  rate: number; // USD to currency rate
}

// Current approximate exchange rates (update these as needed)
const RATES: CurrencyRate[] = [
  { currency: 'NGN', token: 'ADNGN', symbol: '₦', rate: 1580 },
  { currency: 'KES', token: 'ADKES', symbol: 'KSh', rate: 129 },
  { currency: 'GHS', token: 'ADGHS', symbol: '₵', rate: 15.5 },
  { currency: 'ZAR', token: 'ADZAR', symbol: 'R', rate: 18.2 },
];

const RATE_PRECISION = BigInt('1000000000000000000'); // 1e18

// USDC has 6 decimals, Adam tokens have 18 decimals
// To convert 1 USDC (1e6) to 1 ADUSD (1e18), multiply by 1e12
const DECIMAL_ADJUSTMENT = BigInt('1000000000000'); // 1e12

async function setAllRates() {
  const rpcUrl = process.env.STARKNET_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const accountAddress = process.env.DEPLOYER_ADDRESS;
  const swapAddress = process.env.ADAM_SWAP_ADDRESS;
  const adusdAddress = process.env.ADUSD_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;

  if (!rpcUrl || !privateKey || !accountAddress || !swapAddress || !adusdAddress || !usdcAddress) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const tokenAddresses: Record<string, string> = {
    ADUSD: adusdAddress,
    ADNGN: process.env.ADNGN_ADDRESS!,
    ADKES: process.env.ADKES_ADDRESS!,
    ADGHS: process.env.ADGHS_ADDRESS!,
    ADZAR: process.env.ADZAR_ADDRESS!,
  };

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account({
    provider,
    address: accountAddress,
    signer: privateKey,
  });

  console.log('========================================');
  console.log('Setting All Currency Rates On-Chain');
  console.log('========================================');
  console.log('Swap contract:', swapAddress);
  console.log('USDC address:', usdcAddress);
  console.log('ADUSD address:', adusdAddress);
  console.log('');

  const calls: Array<{
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }> = [];

  // ============================================
  // Part 1: Set USDC <-> All Adam Tokens
  // ============================================
  console.log('Part 1: Setting USDC <-> Adam Token Rates');
  console.log('(Accounting for 6 vs 18 decimal difference)');
  console.log('');

  // USDC -> ADUSD (1:1 with decimal adjustment)
  const usdcToAdusdRate = RATE_PRECISION * DECIMAL_ADJUSTMENT; // 1e30
  const adusdToUsdcRate = RATE_PRECISION / DECIMAL_ADJUSTMENT; // 1e6
  
  console.log('1. USDC <-> ADUSD (1:1)');
  calls.push({
    contractAddress: swapAddress,
    entrypoint: 'set_rate',
    calldata: [
      usdcAddress,
      adusdAddress,
      (usdcToAdusdRate & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(),
      (usdcToAdusdRate >> BigInt(128)).toString(),
    ],
  });
  calls.push({
    contractAddress: swapAddress,
    entrypoint: 'set_rate',
    calldata: [
      adusdAddress,
      usdcAddress,
      (adusdToUsdcRate & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(),
      (adusdToUsdcRate >> BigInt(128)).toString(),
    ],
  });

  // USDC -> Other Adam Tokens (with currency rate and decimal adjustment)
  for (const { currency, token, symbol, rate } of RATES) {
    const tokenAddress = tokenAddresses[token];
    if (!tokenAddress) {
      console.warn(`⚠️  No address configured for ${token}, skipping...`);
      continue;
    }

    console.log(`${RATES.indexOf({ currency, token, symbol, rate }) + 2}. USDC <-> ${token} (1 USD = ${rate} ${currency})`);

    // USDC -> AD{CURRENCY}: multiply by rate and decimal adjustment
    // Example: 1 USDC (1e6) -> 1580 ADNGN (1580 * 1e18)
    // Rate = 1580 * 1e18 * 1e12 = 1580 * 1e30
    const usdcToTokenRate = BigInt(Math.round(rate * 1e18)) * DECIMAL_ADJUSTMENT;
    
    calls.push({
      contractAddress: swapAddress,
      entrypoint: 'set_rate',
      calldata: [
        usdcAddress,
        tokenAddress,
        (usdcToTokenRate & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(),
        (usdcToTokenRate >> BigInt(128)).toString(),
      ],
    });

    // AD{CURRENCY} -> USDC: divide by rate and decimal adjustment
    // Example: 1580 ADNGN (1580 * 1e18) -> 1 USDC (1e6)
    // Rate = (1e18 / 1580) / 1e12 = 1e6 / 1580
    const tokenToUsdcRate = (RATE_PRECISION / BigInt(Math.round(rate))) / DECIMAL_ADJUSTMENT;
    
    calls.push({
      contractAddress: swapAddress,
      entrypoint: 'set_rate',
      calldata: [
        tokenAddress,
        usdcAddress,
        (tokenToUsdcRate & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(),
        (tokenToUsdcRate >> BigInt(128)).toString(),
      ],
    });
  }

  // ============================================
  // Part 2: Set ADUSD <-> Other Adam Tokens
  // ============================================
  console.log('');
  console.log('Part 2: Setting ADUSD <-> Other Adam Token Rates');
  console.log('(Currency exchange rates, same decimals)');
  console.log('');

  for (const { currency, token, symbol, rate } of RATES) {
    const tokenAddress = tokenAddresses[token];
    if (!tokenAddress) continue;

    console.log(`${RATES.indexOf({ currency, token, symbol, rate }) + 1}. ADUSD <-> ${token} (1 USD = ${rate} ${currency})`);

    // ADUSD -> AD{CURRENCY}: multiply by rate
    // Example: 1 ADUSD (1e18) -> 1580 ADNGN (1580 * 1e18)
    // Rate = 1580 * 1e18
    const rateBigInt = BigInt(Math.round(rate * 1e18));
    const rateU256 = uint256.bnToUint256(rateBigInt);

    calls.push({
      contractAddress: swapAddress,
      entrypoint: 'set_rate',
      calldata: [
        adusdAddress,
        tokenAddress,
        rateU256.low.toString(),
        rateU256.high.toString(),
      ],
    });

    // AD{CURRENCY} -> ADUSD: divide by rate
    // Example: 1580 ADNGN (1580 * 1e18) -> 1 ADUSD (1e18)
    // Rate = 1e18 / 1580
    const inverseRateBigInt = BigInt(Math.round((1 / rate) * 1e18));
    const inverseU256 = uint256.bnToUint256(inverseRateBigInt);

    calls.push({
      contractAddress: swapAddress,
      entrypoint: 'set_rate',
      calldata: [
        tokenAddress,
        adusdAddress,
        inverseU256.low.toString(),
        inverseU256.high.toString(),
      ],
    });
  }

  if (calls.length === 0) {
    console.error('No rates to set');
    process.exit(1);
  }

  console.log('');
  console.log('========================================');
  console.log(`Executing ${calls.length} set_rate calls...`);
  console.log('========================================');
  
  try {
    const result = await account.execute(calls);
    console.log('Transaction hash:', result.transaction_hash);

    console.log('Waiting for transaction confirmation...');
    await provider.waitForTransaction(result.transaction_hash);
    
    console.log('');
    console.log('========================================');
    console.log('✅ All rates set successfully!');
    console.log('========================================');
    console.log('');
    console.log('Summary:');
    console.log('- USDC <-> ADUSD (1:1 with decimal adjustment)');
    for (const { token, rate, currency } of RATES) {
      console.log(`- USDC <-> ${token} (1 USD = ${rate} ${currency})`);
      console.log(`- ADUSD <-> ${token} (1 USD = ${rate} ${currency})`);
    }
  } catch (error) {
    console.error('❌ Error setting rates:', error);
    throw error;
  }
}

setAllRates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
