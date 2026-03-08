import { Account, Contract, RpcProvider, uint256, constants } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

const RECIPIENT =
  '0x04073e73e3020c886d14f35ac20a7694c69768eb8f6d28d8b0d228b7b89b9327';
const AMOUNT_ADNGN = 1_000_000n * 100n; // 1M ADNGN (2 decimals)
const AMOUNT_ADUSD = 1_000_000n * 1_000_000n; // 1M ADUSD (6 decimals)

async function main() {
  console.log('=== Minting Tokens ===');
  console.log(`Recipient: ${RECIPIENT}`);
  console.log(`Amount ADNGN: 1,000,000 (${AMOUNT_ADNGN} raw)`);
  console.log(`Amount ADUSD: 1,000,000 (${AMOUNT_ADUSD} raw)`);
  console.log('');

  // Setup provider and account
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL!,
    chainId: constants.StarknetChainId.SN_SEPOLIA,
  });

  const account = new Account({
    provider,
    address: process.env.DEPLOYER_ADDRESS!,
    signer: process.env.DEPLOYER_PRIVATE_KEY!,
  });

  const adusdAddress = process.env.ADUSD_ADDRESS!;
  const adngnAddress = process.env.ADNGN_ADDRESS!;

  console.log(`ADUSD Token: ${adusdAddress}`);
  console.log(`ADNGN Token: ${adngnAddress}`);
  console.log('');

  // Get contract ABIs
  const adusdAbi = await provider.getClassAt(adusdAddress);
  const adngnAbi = await provider.getClassAt(adngnAddress);

  const adusdContract = new Contract({
    abi: adusdAbi.abi,
    address: adusdAddress,
    providerOrAccount: account,
  });

  const adngnContract = new Contract({
    abi: adngnAbi.abi,
    address: adngnAddress,
    providerOrAccount: account,
  });

  // Convert amounts to uint256
  const adusdAmount = uint256.bnToUint256(AMOUNT_ADUSD);
  const adngnAmount = uint256.bnToUint256(AMOUNT_ADNGN);

  try {
    // Mint ADUSD
    console.log('Minting ADUSD...');
    const adusdTx = (await adusdContract.call('mint', [
      RECIPIENT,
      adusdAmount,
    ])) as {
      transaction_hash: string;
    };
    console.log(`ADUSD mint tx: ${adusdTx.transaction_hash}`);
    await provider.waitForTransaction(adusdTx.transaction_hash);
    console.log('✅ ADUSD minted successfully!');
    console.log('');

    // Mint ADNGN
    console.log('Minting ADNGN...');
    const adngnTx = (await adngnContract.call('mint', [
      RECIPIENT,
      adngnAmount,
    ])) as {
      transaction_hash: string;
    };
    console.log(`ADNGN mint tx: ${adngnTx.transaction_hash}`);
    await provider.waitForTransaction(adngnTx.transaction_hash);
    console.log('✅ ADNGN minted successfully!');
    console.log('');

    console.log('=== Minting Complete ===');
    console.log(`Recipient ${RECIPIENT} now has:`);
    console.log('  - 1,000,000 ADUSD');
    console.log('  - 1,000,000 ADNGN');
  } catch (error) {
    console.error('❌ Minting failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to mint tokens:', err);
  process.exit(1);
});
