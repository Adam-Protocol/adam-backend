/**
 * Grant RATE_SETTER_ROLE to backend wallet
 * 
 * Run this script once after deployment:
 * npx ts-node -r tsconfig-paths/register src/scripts/grant-rate-setter-role.ts
 */
import { Account, RpcProvider, hash } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

// Load env from .env file manually
const envPath = path.join(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
  }
});

async function main() {
  const provider = new RpcProvider({
    nodeUrl: env.STARKNET_RPC_URL!,
  });

  const account = new Account(
    provider,
    env.DEPLOYER_ADDRESS!,
    env.DEPLOYER_PRIVATE_KEY!,
  );

  const swapAddress = env.ADAM_SWAP_ADDRESS!;
  const backendWallet = env.DEPLOYER_ADDRESS!; // Backend uses deployer wallet

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
