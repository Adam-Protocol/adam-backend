/**
 * Adam Protocol — Deploy Script
 *
 * Deploys ADUSD, ADNGN, AdamPool, AdamSwap to Starknet Sepolia.
 * Run: npx ts-node scripts/deploy.ts
 *
 * Prerequisites:
 *   - Compiled contracts in ./target/dev/
 *   - DEPLOYER_PRIVATE_KEY and DEPLOYER_ADDRESS in .env
 */
import { config } from 'dotenv';
import {
  Account,
  Contract,
  RpcProvider,
  CallData,
  json,
  hash,
} from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

config();

const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL! });
const account = new Account(provider, process.env.DEPLOYER_ADDRESS!, process.env.DEPLOYER_PRIVATE_KEY!);

function readCompiledContract(name: string) {
  const sierraPath = path.join(__dirname, '..', '..', 'adam-contract', 'target', 'dev', `${name}.contract_class.json`);
  const casmPath = path.join(__dirname, '..', '..', 'adam-contract', 'target', 'dev', `${name}.compiled_contract_class.json`);
  return {
    sierra: json.parse(fs.readFileSync(sierraPath).toString()),
    casm: json.parse(fs.readFileSync(casmPath).toString()),
  };
}

async function declareIfNeeded(name: string) {
  const { sierra, casm } = readCompiledContract(name);
  const classHash = hash.computeSierraContractClassHash(sierra);
  try {
    await provider.getClassByHash(classHash);
    console.log(`  ${name} already declared: ${classHash}`);
    return classHash;
  } catch {
    console.log(`  Declaring ${name}...`);
    const { class_hash } = await account.declare({ contract: sierra, casm });
    await provider.waitForTransaction(hash);
    console.log(`  ${name} declared: ${class_hash}`);
    return class_hash;
  }
}

async function deploy(classHash: string, calldata: any[], label: string) {
  console.log(`  Deploying ${label}...`);
  const { contract_address, transaction_hash } = await account.deploy({
    classHash,
    constructorCalldata: calldata,
  });
  await provider.waitForTransaction(transaction_hash);
  console.log(`  ${label} deployed: ${contract_address}`);
  return contract_address;
}

async function main() {
  console.log('=== Adam Protocol Deploy ===');
  console.log(`Deployer: ${process.env.DEPLOYER_ADDRESS}`);
  console.log(`Chain: ${process.env.STARKNET_CHAIN_ID ?? 'SN_SEPOLIA'}\n`);

  // 1. Declare all classes
  console.log('Declaring contracts...');
  const tokenClassHash = await declareIfNeeded('adam_token_AdamToken');
  const poolClassHash = await declareIfNeeded('adam_pool_AdamPool');
  const swapClassHash = await declareIfNeeded('adam_swap_AdamSwap');

  // 2. Deploy ADUSD
  console.log('\nDeploying ADUSD...');
  const adusdCalldata = CallData.compile({
    name: 'Adam USD',
    symbol: 'ADUSD',
    owner: process.env.DEPLOYER_ADDRESS!,
  });
  const adusdAddress = await deploy(tokenClassHash, adusdCalldata, 'ADUSD');

  // 3. Deploy ADNGN
  console.log('\nDeploying ADNGN...');
  const adngnCalldata = CallData.compile({
    name: 'Adam NGN',
    symbol: 'ADNGN',
    owner: process.env.DEPLOYER_ADDRESS!,
  });
  const adngnAddress = await deploy(tokenClassHash, adngnCalldata, 'ADNGN');

  // 4. Deploy AdamPool
  console.log('\nDeploying AdamPool...');
  const poolCalldata = CallData.compile({ owner: process.env.DEPLOYER_ADDRESS! });
  const poolAddress = await deploy(poolClassHash, poolCalldata, 'AdamPool');

  // 5. Deploy AdamSwap
  console.log('\nDeploying AdamSwap...');
  const swapCalldata = CallData.compile({
    owner: process.env.DEPLOYER_ADDRESS!,
    treasury: process.env.TREASURY_ADDRESS!,
    usdc_address: process.env.USDC_ADDRESS!,
    adusd_address: adusdAddress,
    adngn_address: adngnAddress,
    pool_address: poolAddress,
    fee_bps: 30,
  });
  const swapAddress = await deploy(swapClassHash, swapCalldata, 'AdamSwap');

  // 6. Set up roles
  console.log('\nSetting up roles...');
  const MINTER_ROLE = '0x' + BigInt('0x4f96f87f6963bb246f2c30526628466840c642dc5c50d5a67777c6cc0d4174').toString(16);
  const BURNER_ROLE = '0x' + BigInt('0x7823a2d975ffa03bed39ca4c897c5f49b4b664a48e4c55b1fd23b13463cafd6').toString(16);

  await account.execute([
    // Grant MINTER_ROLE on ADUSD to Swap
    { contractAddress: adusdAddress, entrypoint: 'grant_role', calldata: [MINTER_ROLE, swapAddress] },
    // Grant BURNER_ROLE on ADUSD to Swap
    { contractAddress: adusdAddress, entrypoint: 'grant_role', calldata: [BURNER_ROLE, swapAddress] },
    // Grant MINTER_ROLE on ADNGN to Swap
    { contractAddress: adngnAddress, entrypoint: 'grant_role', calldata: [MINTER_ROLE, swapAddress] },
    // Grant BURNER_ROLE on ADNGN to Swap
    { contractAddress: adngnAddress, entrypoint: 'grant_role', calldata: [BURNER_ROLE, swapAddress] },
    // Set swap contract on Pool
    { contractAddress: poolAddress, entrypoint: 'set_swap_contract', calldata: [swapAddress] },
    // Grant RATE_SETTER_ROLE on Swap to deployer (backend wallet)
    { contractAddress: swapAddress, entrypoint: 'grant_rate_setter_role', calldata: [process.env.DEPLOYER_ADDRESS!] },
  ]);
  console.log('  Roles configured.');

  // 7. Print deployment summary
  const summary = {
    ADUSD_ADDRESS: adusdAddress,
    ADNGN_ADDRESS: adngnAddress,
    ADAM_POOL_ADDRESS: poolAddress,
    ADAM_SWAP_ADDRESS: swapAddress,
  };

  console.log('\n=== Deployment Complete ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nCopy these values to your .env files in adam-backend and adam-app.');

  // Write deployment.json
  fs.writeFileSync(
    path.join(__dirname, 'deployment.json'),
    JSON.stringify({ ...summary, timestamp: new Date().toISOString() }, null, 2),
  );
  console.log('Saved to scripts/deployment.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
