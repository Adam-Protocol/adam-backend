const { RpcProvider, Contract } = require('starknet');

const USDC_ADDRESS = '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080';
const USER_ADDRESS = '0x04073e73e3020c886d14f35ac20a7694c69768eb8f6d28d8b0d228b7b89b9327';
const SWAP_ADDRESS = '0x07984588fbc7ba62d1ac9758841b9884aac028ae2960289ed63bb0dd7b5718c8';

const ERC20_ABI = {
  abi: [
    {
      name: 'balanceOf',
      type: 'function',
      inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
      outputs: [{ type: 'core::integer::u256' }],
      state_mutability: 'view',
    },
    {
      name: 'allowance',
      type: 'function',
      inputs: [
        { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
        { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      ],
      outputs: [{ type: 'core::integer::u256' }],
      state_mutability: 'view',
    },
  ],
};

async function checkBalance() {
  const provider = new RpcProvider({
    nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/5QQMV6kqa3iDaH_EbNhTw',
  });

  const usdcContract = new Contract(ERC20_ABI.abi, USDC_ADDRESS, provider);

  try {
    // Check balance
    const balance = await usdcContract.balanceOf(USER_ADDRESS);
    const balanceLow = BigInt(balance.low || balance[0] || 0);
    const balanceHigh = BigInt(balance.high || balance[1] || 0);
    const totalBalance = balanceLow + (balanceHigh << 128n);
    
    console.log('\n=== USDC Balance Check ===');
    console.log('User Address:', USER_ADDRESS);
    console.log('USDC Balance (raw):', totalBalance.toString());
    console.log('USDC Balance (formatted):', (Number(totalBalance) / 1e6).toFixed(6), 'USDC');

    // Check allowance
    const allowance = await usdcContract.allowance(USER_ADDRESS, SWAP_ADDRESS);
    const allowanceLow = BigInt(allowance.low || allowance[0] || 0);
    const allowanceHigh = BigInt(allowance.high || allowance[1] || 0);
    const totalAllowance = allowanceLow + (allowanceHigh << 128n);
    
    console.log('\n=== Allowance Check ===');
    console.log('Swap Contract:', SWAP_ADDRESS);
    console.log('Allowance (raw):', totalAllowance.toString());
    console.log('Allowance (formatted):', (Number(totalAllowance) / 1e6).toFixed(6), 'USDC');

    // Check if user has enough for 1 USDC transaction
    const requiredAmount = 1000000n; // 1 USDC
    console.log('\n=== Transaction Check ===');
    console.log('Required Amount:', (Number(requiredAmount) / 1e6).toFixed(6), 'USDC');
    console.log('Has Sufficient Balance:', totalBalance >= requiredAmount);
    console.log('Has Sufficient Allowance:', totalAllowance >= requiredAmount);

    if (totalBalance < requiredAmount) {
      console.log('\n⚠️  ISSUE: Insufficient USDC balance!');
      console.log('You need to mint or transfer USDC to this address.');
    }

    if (totalAllowance < requiredAmount) {
      console.log('\n⚠️  ISSUE: Insufficient allowance!');
      console.log('You need to approve the swap contract to spend USDC.');
    }

  } catch (error) {
    console.error('Error checking balance:', error.message);
  }
}

checkBalance();
