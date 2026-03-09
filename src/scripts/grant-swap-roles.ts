import { Account, RpcProvider, hash } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

async function grantSwapRoles() {
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL,
  });

  const account = new Account({
    provider,
    address: process.env.DEPLOYER_ADDRESS!,
    signer: process.env.DEPLOYER_PRIVATE_KEY!,
  });

  const swapAddress = process.env.ADAM_SWAP_ADDRESS!;
  const adusdAddress = process.env.ADUSD_ADDRESS!;
  const adngnAddress = process.env.ADNGN_ADDRESS!;
  const adkesAddress = process.env.ADKES_ADDRESS!;
  const adghsAddress = process.env.ADGHS_ADDRESS!;
  const adzarAddress = process.env.ADZAR_ADDRESS!;

  const MINTER_ROLE = hash.getSelectorFromName('MINTER_ROLE');
  const BURNER_ROLE = hash.getSelectorFromName('BURNER_ROLE');

  console.log('Granting MINTER_ROLE and BURNER_ROLE to AdamSwap contract...');
  console.log('Swap contract:', swapAddress);
  console.log('ADUSD token:', adusdAddress);
  console.log('ADNGN token:', adngnAddress);
  console.log('ADKES token:', adkesAddress);
  console.log('ADGHS token:', adghsAddress);
  console.log('ADZAR token:', adzarAddress);
  console.log('MINTER_ROLE:', MINTER_ROLE);
  console.log('BURNER_ROLE:', BURNER_ROLE);

  try {
    // Grant MINTER_ROLE to swap contract on ADUSD
    console.log('\n1. Granting MINTER_ROLE on ADUSD...');
    const { transaction_hash: tx1 } = await account.execute([
      {
        contractAddress: adusdAddress,
        entrypoint: 'grant_role',
        calldata: [MINTER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx1);
    await provider.waitForTransaction(tx1);
    console.log('✅ MINTER_ROLE granted on ADUSD');

    // Grant BURNER_ROLE to swap contract on ADUSD
    console.log('\n2. Granting BURNER_ROLE on ADUSD...');
    const { transaction_hash: tx2 } = await account.execute([
      {
        contractAddress: adusdAddress,
        entrypoint: 'grant_role',
        calldata: [BURNER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx2);
    await provider.waitForTransaction(tx2);
    console.log('✅ BURNER_ROLE granted on ADUSD');

    // Grant MINTER_ROLE to swap contract on ADNGN
    console.log('\n3. Granting MINTER_ROLE on ADNGN...');
    const { transaction_hash: tx3 } = await account.execute([
      {
        contractAddress: adngnAddress,
        entrypoint: 'grant_role',
        calldata: [MINTER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx3);
    await provider.waitForTransaction(tx3);
    console.log('✅ MINTER_ROLE granted on ADNGN');

    // Grant BURNER_ROLE to swap contract on ADNGN
    console.log('\n4. Granting BURNER_ROLE on ADNGN...');
    const { transaction_hash: tx4 } = await account.execute([
      {
        contractAddress: adngnAddress,
        entrypoint: 'grant_role',
        calldata: [BURNER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx4);
    await provider.waitForTransaction(tx4);
    console.log('✅ BURNER_ROLE granted on ADNGN');

    // Grant MINTER_ROLE to swap contract on ADKES
    console.log('\n5. Granting MINTER_ROLE on ADKES...');
    const { transaction_hash: tx5 } = await account.execute([
      {
        contractAddress: adkesAddress,
        entrypoint: 'grant_role',
        calldata: [MINTER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx5);
    await provider.waitForTransaction(tx5);
    console.log('✅ MINTER_ROLE granted on ADKES');

    // Grant BURNER_ROLE to swap contract on ADKES
    console.log('\n6. Granting BURNER_ROLE on ADKES...');
    const { transaction_hash: tx6 } = await account.execute([
      {
        contractAddress: adkesAddress,
        entrypoint: 'grant_role',
        calldata: [BURNER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx6);
    await provider.waitForTransaction(tx6);
    console.log('✅ BURNER_ROLE granted on ADKES');

    // Grant MINTER_ROLE to swap contract on ADGHS
    console.log('\n7. Granting MINTER_ROLE on ADGHS...');
    const { transaction_hash: tx7 } = await account.execute([
      {
        contractAddress: adghsAddress,
        entrypoint: 'grant_role',
        calldata: [MINTER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx7);
    await provider.waitForTransaction(tx7);
    console.log('✅ MINTER_ROLE granted on ADGHS');

    // Grant BURNER_ROLE to swap contract on ADGHS
    console.log('\n8. Granting BURNER_ROLE on ADGHS...');
    const { transaction_hash: tx8 } = await account.execute([
      {
        contractAddress: adghsAddress,
        entrypoint: 'grant_role',
        calldata: [BURNER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx8);
    await provider.waitForTransaction(tx8);
    console.log('✅ BURNER_ROLE granted on ADGHS');

    // Grant MINTER_ROLE to swap contract on ADZAR
    console.log('\n9. Granting MINTER_ROLE on ADZAR...');
    const { transaction_hash: tx9 } = await account.execute([
      {
        contractAddress: adzarAddress,
        entrypoint: 'grant_role',
        calldata: [MINTER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx9);
    await provider.waitForTransaction(tx9);
    console.log('✅ MINTER_ROLE granted on ADZAR');

    // Grant BURNER_ROLE to swap contract on ADZAR
    console.log('\n10. Granting BURNER_ROLE on ADZAR...');
    const { transaction_hash: tx10 } = await account.execute([
      {
        contractAddress: adzarAddress,
        entrypoint: 'grant_role',
        calldata: [BURNER_ROLE, swapAddress],
      },
    ]);
    console.log('Transaction hash:', tx10);
    await provider.waitForTransaction(tx10);
    console.log('✅ BURNER_ROLE granted on ADZAR');

    console.log('\n✅ All roles granted successfully!');
  } catch (error: unknown) {
    if (
      (error as { message?: string }).message?.includes('already granted') ||
      (error as { message?: string }).message?.includes('already has role')
    ) {
      console.log('✅ Roles already granted!');
    } else {
      console.error('❌ Error granting roles:', error);
      throw error;
    }
  }
}

grantSwapRoles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
