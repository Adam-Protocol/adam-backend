const { RpcProvider, Contract } = require('starknet');

const ADUSD_ADDRESS = '0x067d4437b253839c88b7a3cf6a530e767acfbc6a40ccfa52a02c3e1604779a2d';
const ADNGN_ADDRESS = '0x0794495de4eabf33a7799884134f9010624293b7fb84a2586dd8e2638e1e3267';
const RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/5QQMV6kqa3iDaH_EbNhTw';

async function checkDecimals() {
  try {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    
    // Get ADUSD decimals
    const { abi: adusdAbi } = await provider.getClassAt(ADUSD_ADDRESS);
    const adusdContract = new Contract({ abi: adusdAbi, address: ADUSD_ADDRESS, providerOrAccount: provider });
    
    const adusdDecimals = await adusdContract.decimals();
    console.log('ADUSD decimals:', adusdDecimals.toString());
    
    // Get ADNGN decimals
    const { abi: adngnAbi } = await provider.getClassAt(ADNGN_ADDRESS);
    const adngnContract = new Contract({ abi: adngnAbi, address: ADNGN_ADDRESS, providerOrAccount: provider });
    
    const adngnDecimals = await adngnContract.decimals();
    console.log('ADNGN decimals:', adngnDecimals.toString());
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDecimals();
