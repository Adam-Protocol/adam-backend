/**
 * Script to manually set currency rates on-chain
 * Usage: npx ts-node src/scripts/set-currency-rates.ts
 */

import { config } from 'dotenv';
import { Account, RpcProvider, uint256 } from 'starknet';

config();

interface CurrencyRate {
  currency: string;
  token: string;
  rate: number; // USD to currency rate
}

// Current approximate exchange rates (update these as needed)
const RATES: CurrencyRate[] = [
  { currency: 'NGN', token: 'ADNGN', rate: 1580 }, // 1 USD = 1580 NGN
  { currency: 'KES', token: 'ADKES', rate: 129 }, // 1 USD = 129 KES
  { currency: 'GHS', token: 'ADGHS', rate: 15.5 }, // 1 USD = 15.5 GHS
  { currency: 'ZAR', token: 'ADZAR', rate: 18.2 }, // 1 USD = 18.2 ZAR
];

async function setRates() {
  const rpcUrl = process.env.STARKNET_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const accountAddress = process.env.DEPLOYER_ADDRESS;
  const swapAddress = process.env.ADAM_SWAP_ADDRESS;
  const adusdAddress = process.env.ADUSD_ADDRESS;

  if (!rpcUrl || !privateKey || !accountAddress || !swapAddress || !adusdAddress) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const tokenAddresses: Record<string, string> = {
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

  console.log('Setting currency rates on-chain...');
  console.log('Swap contract:', swapAddress);
  console.log('ADUSD address:', adusdAddress);
  console.log('');

  const calls: Array<{
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }> = [];

  for (const { currency, token, rate } of RATES) {
    const tokenAddress = tokenAddresses[token];
    if (!tokenAddress) {
      console.warn(`⚠️  No address configured for ${token}, skipping...`);
      continue;
    }

    console.log(`Setting rate: 1 ADUSD = ${rate} ${currency} (${token})`);

    // Rate scaled by 1e18
    const rateBigInt = BigInt(Math.round(rate * 1e18));
    const rateU256 = uint256.bnToUint256(rateBigInt);
    const inverseRateBigInt = BigInt(Math.round((1 / rate) * 1e18));
    const inverseU256 = uint256.bnToUint256(inverseRateBigInt);

    // ADUSD -> AD{CURRENCY}
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

    // AD{CURRENCY} -> ADUSD
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

  console.log(`\nExecuting ${calls.length} set_rate calls...`);
  const result = await account.execute(calls);
  console.log('Transaction hash:', result.transaction_hash);

  console.log('Waiting for transaction confirmation...');
  await provider.waitForTransaction(result.transaction_hash);
  console.log('✅ All rates set successfully!');
}

setRates().catch((error) => {
  console.error('Error setting rates:', error);
  process.exit(1);
});
