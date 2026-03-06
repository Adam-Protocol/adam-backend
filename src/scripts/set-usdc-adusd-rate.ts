import { Account, RpcProvider } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

const RATE_PRECISION = BigInt('1000000000000000000'); // 1e18

// USDC has 6 decimals, ADUSD has 18 decimals
// To convert 1 USDC (1e6) to 1 ADUSD (1e18), we need to multiply by 1e12
// Rate = 1e18 * 1e12 = 1e30
const USDC_TO_ADUSD_RATE = RATE_PRECISION * BigInt('1000000000000'); // 1e18 * 1e12 = 1e30

// To convert 1 ADUSD (1e18) to 1 USDC (1e6), we need to divide by 1e12
// Rate = 1e18 / 1e12 = 1e6
const ADUSD_TO_USDC_RATE = RATE_PRECISION / BigInt('1000000000000'); // 1e18 / 1e12 = 1e6

async function setUsdcAdusdRate() {
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL,
  });

  const account = new Account({
    provider,
    address: process.env.DEPLOYER_ADDRESS!,
    signer: process.env.DEPLOYER_PRIVATE_KEY!,
  });

  const swapAddress = process.env.ADAM_SWAP_ADDRESS!;
  const usdcAddress = process.env.USDC_ADDRESS!;
  const adusdAddress = process.env.ADUSD_ADDRESS!;

  console.log('Setting USDC <-> ADUSD rate (accounting for decimal difference)');
  console.log('USDC decimals: 6, ADUSD decimals: 18');
  console.log('Swap contract:', swapAddress);
  console.log('USDC address:', usdcAddress);
  console.log('ADUSD address:', adusdAddress);
  console.log('USDC -> ADUSD rate:', USDC_TO_ADUSD_RATE.toString(), '(1e30)');
  console.log('ADUSD -> USDC rate:', ADUSD_TO_USDC_RATE.toString(), '(1e6)');

  try {
    // Set USDC -> ADUSD rate (multiply by 1e12 to account for decimal difference)
    const { transaction_hash: tx1 } = await account.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'set_rate',
        calldata: [
          usdcAddress,
          adusdAddress,
          (USDC_TO_ADUSD_RATE & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(), // low part
          (USDC_TO_ADUSD_RATE >> BigInt(128)).toString(), // high part
        ],
      },
    ]);

    console.log('\nUSDC -> ADUSD transaction hash:', tx1);
    await provider.waitForTransaction(tx1);
    console.log('✅ USDC -> ADUSD rate set successfully!');

    // Set ADUSD -> USDC rate (divide by 1e12 to account for decimal difference)
    const { transaction_hash: tx2 } = await account.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'set_rate',
        calldata: [
          adusdAddress,
          usdcAddress,
          (ADUSD_TO_USDC_RATE & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(), // low part
          (ADUSD_TO_USDC_RATE >> BigInt(128)).toString(), // high part
        ],
      },
    ]);

    console.log('\nADUSD -> USDC transaction hash:', tx2);
    await provider.waitForTransaction(tx2);
    console.log('✅ ADUSD -> USDC rate set successfully!');

    console.log('\n✅ All rates set correctly (accounting for 6 vs 18 decimal difference)');
  } catch (error) {
    console.error('❌ Error setting rates:', error);
    throw error;
  }
}

setUsdcAdusdRate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
