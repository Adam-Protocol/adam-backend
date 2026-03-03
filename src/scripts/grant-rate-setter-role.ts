/**
 * Grant RATE_SETTER_ROLE to backend wallet
 * 
 * Run this script once after deployment:
 * npx ts-node src/scripts/grant-rate-setter-role.ts
 */
import { config } from 'dotenv';
import { Account, RpcProvider, hash } from 'starknet';

config();

async function main() {
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL!,
  });

  const account = new Account(
    provider,
    process.env.DEPLOYER_ADDRESS!,
    process.env.DEPLOYER_PRIVATE_KEY!,
  );

  const swapAddress = process.env.ADAM_SWAP_ADDRESS!;
  const backendWallet = process.env.DEPLOYER_ADDRESS!; // Backend uses deployer wallet

  // Calculate RATE_SETTER_ROLE hash
  const RATE_SETTER_ROLE = hash.getSelectorFromName('RATE_SETTER_ROLE');

  console.log('Granting RATE_SETTER_ROLE to backend wallet...');
  console.log(`Swap Contract: ${swapAddress}`);
  console.log(`Backend Wallet: ${backendWallet}`);
  console.log(`Role Hash: ${RATE_SETTER_ROLE}`);

  const { transaction_hash } = await account.execute([
    {
      contractAddress: swapAddress,
      entrypoint: 'grant_role',
      calldata: [RATE_SETTER_ROLE, backendWallet],
    },
  ]);

  console.log(`Transaction submitted: ${transaction_hash}`);
  await provider.waitForTransaction(transaction_hash);
  console.log('✅ RATE_SETTER_ROLE granted successfully!');
}

main().catch((err) => {
  console.error('Failed to grant role:', err);
  process.exit(1);
});
