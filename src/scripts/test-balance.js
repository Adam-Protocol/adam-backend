const { RpcProvider, Contract } = require('starknet');

const ADUSD_ADDRESS = '0x067d4437b253839c88b7a3cf6a530e767acfbc6a40ccfa52a02c3e1604779a2d';
const ADNGN_ADDRESS = '0x0794495de4eabf33a7799884134f9010624293b7fb84a2586dd8e2638e1e3267';
const RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/5QQMV6kqa3iDaH_EbNhTw';

// Test wallet address from screenshot (you'll need to provide the full address)
const WALLET_ADDRESS = process.argv[2] || '0x4c73687f23639fdfd8d7d71ea7fccd62866351b0eff5efea14148c7b6ee5b27';

async function testBalance() {
  try {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    
    console.log('Testing balance for wallet:', WALLET_ADDRESS);
    console.log('ADUSD Token:', ADUSD_ADDRESS);
    console.log('ADNGN Token:', ADNGN_ADDRESS);
    console.log('');
    
    // Get contract ABI
    const { abi: adusdAbi } = await provider.getClassAt(ADUSD_ADDRESS);
    const adusdContract = new Contract({ abi: adusdAbi, address: ADUSD_ADDRESS, providerOrAccount: provider });
    
    const { abi: adngnAbi } = await provider.getClassAt(ADNGN_ADDRESS);
    const adngnContract = new Contract({ abi: adngnAbi, address: ADNGN_ADDRESS, providerOrAccount: provider });
    
    // Get balances
    console.log('Fetching ADUSD balance...');
    const adusdResult = await adusdContract.balance_of(WALLET_ADDRESS);
    console.log('ADUSD raw result:', adusdResult);
    
    const adusdBalance = adusdResult.balance || adusdResult;
    const adusdLow = BigInt(adusdBalance.low || adusdBalance[0] || 0);
    const adusdHigh = BigInt(adusdBalance.high || adusdBalance[1] || 0);
    const adusdTotal = adusdLow + (adusdHigh << 128n);
    console.log('ADUSD balance:', adusdTotal.toString(), '(', Number(adusdTotal) / 1e18, 'ADUSD)');
    console.log('');
    
    console.log('Fetching ADNGN balance...');
    const adngnResult = await adngnContract.balance_of(WALLET_ADDRESS);
    console.log('ADNGN raw result:', adngnResult);
    
    const adngnBalance = adngnResult.balance || adngnResult;
    const adngnLow = BigInt(adngnBalance.low || adngnBalance[0] || 0);
    const adngnHigh = BigInt(adngnBalance.high || adngnBalance[1] || 0);
    const adngnTotal = adngnLow + (adngnHigh << 128n);
    console.log('ADNGN balance:', adngnTotal.toString(), '(', Number(adngnTotal) / 1e18, 'ADNGN)');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

testBalance();
