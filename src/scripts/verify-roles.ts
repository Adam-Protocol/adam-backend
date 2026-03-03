/**
 * Verify all roles are correctly configured
 * 
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/verify-roles.ts
 */
import { Account, RpcProvider, Contract, hash } from 'starknet';
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

  const adusdAddress = env.ADUSD_ADDRESS!;
  const adngnAddress = env.ADNGN_ADDRESS!;
  const swapAddress = env.ADAM_SWAP_ADDRESS!;
  const poolAddress = env.ADAM_POOL_ADDRESS!;

  console.log('=== Role Verification ===\n');

  // Role hashes
  const MINTER_ROLE = hash.getSelectorFromName('MINTER_ROLE');
  const BURNER_ROLE = hash.getSelectorFromName('BURNER_ROLE');
  const RATE_SETTER_ROLE = hash.getSelectorFromName('RATE_SETTER_ROLE');

  // Get contract ABIs
  const adusdAbi = await provider.getClassAt(adusdAddress);
  const swapAbi = await provider.getClassAt(swapAddress);
  const poolAbi = await provider.getClassAt(poolAddress);

  const adusd = new Contract(adusdAbi.abi, adusdAddress, provider);
  const adngn = new Contract(adusdAbi.abi, adngnAddress, provider);
  const swap = new Contract(swapAbi.abi, swapAddress, provider);
  const pool = new Contract(poolAbi.abi, poolAddress, provider);

  // Check ADUSD roles
  console.log('ADUSD Token:');
  const adusdMinter = await adusd.has_role(MINTER_ROLE, swapAddress);
  const adusdBurner = await adusd.has_role(BURNER_ROLE, swapAddress);
  console.log(`  MINTER_ROLE (AdamSwap): ${adusdMinter ? '✅' : '❌'}`);
  console.log(`  BURNER_ROLE (AdamSwap): ${adusdBurner ? '✅' : '❌'}`);

  // Check ADNGN roles
  console.log('\nADNGN Token:');
  const adngnMinter = await adngn.has_role(MINTER_ROLE, swapAddress);
  const adngnBurner = await adngn.has_role(BURNER_ROLE, swapAddress);
  console.log(`  MINTER_ROLE (AdamSwap): ${adngnMinter ? '✅' : '❌'}`);
  console.log(`  BURNER_ROLE (AdamSwap): ${adngnBurner ? '✅' : '❌'}`);

  // Check AdamSwap roles
  console.log('\nAdamSwap:');
  const backendWallet = process.env.DEPLOYER_ADDRESS!;
  const rateSetter = await swap.has_role(RATE_SETTER_ROLE, backendWallet);
  console.log(`  RATE_SETTER_ROLE (Backend): ${rateSetter ? '✅' : '❌'}`);

  // Check AdamPool configuration
  console.log('\nAdamPool:');
  const poolSwapContract = await pool.swap_contract();
  const poolConfigured = poolSwapContract === swapAddress;
  console.log(`  swap_contract set to AdamSwap: ${poolConfigured ? '✅' : '❌'}`);
  if (!poolConfigured) {
    console.log(`    Expected: ${swapAddress}`);
    console.log(`    Actual: ${poolSwapContract}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  const allGood = adusdMinter && adusdBurner && adngnMinter && adngnBurner && rateSetter && poolConfigured;
  if (allGood) {
    console.log('✅ All roles configured correctly!');
  } else {
    console.log('❌ Some roles are missing. Run deployment script or grant roles manually.');
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});