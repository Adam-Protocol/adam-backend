import { Account, RpcProvider } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

async function setUsdcAddress() {
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL,
  });

  const account = new Account({
    provider,
    address: process.env.DEPLOYER_ADDRESS!,
    signer: process.env.DEPLOYER_PRIVATE_KEY!,
  });

  const swapAddress = process.env.ADAM_SWAP_ADDRESS!;
  const usdcAddress = '0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343';

  console.log('Setting USDC address to:', usdcAddress);
  console.log('Swap contract:', swapAddress);

  try {
    const { transaction_hash } = await account.execute([
      {
        contractAddress: swapAddress,
        entrypoint: 'set_usdc_address',
        calldata: [usdcAddress],
      },
    ]);

    console.log('Transaction hash:', transaction_hash);
    
    await provider.waitForTransaction(transaction_hash);
    console.log('✅ USDC address set successfully!');
  } catch (error) {
    console.error('❌ Error setting USDC address:', error);
    throw error;
  }
}

setUsdcAddress()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
