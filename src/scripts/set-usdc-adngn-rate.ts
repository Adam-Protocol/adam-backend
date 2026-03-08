import { Account, RpcProvider } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

const RATE_PRECISION = BigInt('1000000000000000000'); // 1e18

// USDC has 6 decimals, ADNGN has 18 decimals
// 1 USD = 1385.81 NGN
// To convert 1 USDC (1e6) to 1385.81 ADNGN (1385.81e18), we need to multiply by 1385.81 * 1e12
// Rate = 1385.81 * 1e18 * 1e12 = 1385.81e30
const USD_TO_NGN_RATE = 1385.81;
const USDC_TO_ADNGN_RATE =
  BigInt(Math.floor(USD_TO_NGN_RATE * 1e12)) * RATE_PRECISION; // 1385.81 * 1e30

// To convert 1 ADNGN (1e18) to USDC (1e6), we need to divide by 1385.81 * 1e12
// Rate = 1e18 / (1385.81 * 1e12) = 1e6 / 1385.81
const ADNGN_TO_USDC_RATE =
  RATE_PRECISION / BigInt(Math.floor(USD_TO_NGN_RATE * 1e12)); // 1e6 / 1385.81

async function setUsdcAdngnRate() {
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
  const adngnAddress = process.env.ADNGN_ADDRESS!;

  console.log('Setting USDC <-> ADNGN rate (1 USD = 1385.81 NGN)');
  console.log('USDC decimals: 6, ADNGN decimals: 18');
  console.log('Swap contract:', swapAddress);
  console.log('USDC address:', usdcAddress);
  console.log('ADNGN address:', adngnAddress);
  console.log('USDC -> ADNGN rate:', USDC_TO_ADNGN_RATE.toString());
  console.log('ADNGN -> USDC rate:', ADNGN_TO_USDC_RATE.toString());

  try {
    // Set USDC -> ADNGN rate (multiply by 1385.81 * 1e12 to account for decimal difference and exchange rate)
    const { transaction_hash: tx1 } = await account.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'set_rate',
        calldata: [
          usdcAddress,
          adngnAddress,
          (
            USDC_TO_ADNGN_RATE & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
          ).toString(), // low part
          (USDC_TO_ADNGN_RATE >> BigInt(128)).toString(), // high part
        ],
      },
    ]);

    console.log('\nUSDC -> ADNGN transaction hash:', tx1);
    await provider.waitForTransaction(tx1);
    console.log('✅ USDC -> ADNGN rate set successfully!');

    // Set ADNGN -> USDC rate (divide by 1385.81 * 1e12 to account for decimal difference and exchange rate)
    const { transaction_hash: tx2 } = await account.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'set_rate',
        calldata: [
          adngnAddress,
          usdcAddress,
          (
            ADNGN_TO_USDC_RATE & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
          ).toString(), // low part
          (ADNGN_TO_USDC_RATE >> BigInt(128)).toString(), // high part
        ],
      },
    ]);

    console.log('\nADNGN -> USDC transaction hash:', tx2);
    await provider.waitForTransaction(tx2);
    console.log('✅ ADNGN -> USDC rate set successfully!');

    console.log('\n✅ All rates set correctly (1 USD = 1385.81 NGN)');
  } catch (error) {
    console.error('❌ Error setting rates:', error);
    throw error;
  }
}

setUsdcAdngnRate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
