
import { 
  broadcastTransaction, 
  AnchorMode, 
  makeContractCall,
  stringAsciiCV,
  uintCV,
  principalCV,
  boolCV,
  PostConditionMode
} from '@stacks/transactions';
import { STACKS_TESTNET } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const mnemonic = process.env.STACKS_DEPLOYER_PRIVATE_KEY || '';
const network = STACKS_TESTNET;

// Contract info
const deployer = "STY1XRRA93GJP9YMS2CTHB6M08M11BKPDVRM0191";
const swapContract = `${deployer}.adam-swap`;

const tokens = [
  { symbol: "ADKES", name: "Adam KES", contract: `${deployer}.adam-token-adkes` },
  { symbol: "ADGHS", name: "Adam GHS", contract: `${deployer}.adam-token-adghs` },
  { symbol: "ADZAR", name: "Adam ZAR", contract: `${deployer}.adam-token-adzar` }
];

async function run() {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });
  const account = wallet.accounts[0];
  const privateKey = account.stxPrivateKey;

  console.log(`Starting initialization with account...`);

  for (const token of tokens) {
    try {
      console.log(`Initializing ${token.symbol}...`);
      const [address, contractName] = token.contract.split('.');

      // 1. Initialize
      console.log(`  Sending initialize...`);
      const initTx = await makeContractCall({
        contractAddress: address,
        contractName: contractName,
        functionName: 'initialize',
        functionArgs: [
          stringAsciiCV(token.name),
          stringAsciiCV(token.symbol),
          uintCV(18),
          principalCV(deployer)
        ],
        senderKey: privateKey,
        network,
        postConditionMode: PostConditionMode.Allow
      });
      
      const initRes = await broadcastTransaction({ transaction: initTx, network });
      if ('error' in initRes) {
        console.error(`  Initialize failed: ${initRes.error}`);
      } else {
        console.log(`  Initialize tx: ${initRes.txid}`);
      }
      await new Promise(r => setTimeout(r, 3000));

      // 2. Set Minter
      console.log(`  Sending set-minter...`);
      const minterTx = await makeContractCall({
        contractAddress: address,
        contractName: contractName,
        functionName: 'set-minter',
        functionArgs: [
          principalCV(swapContract),
          boolCV(true)
        ],
        senderKey: privateKey,
        network,
        postConditionMode: PostConditionMode.Allow
      });
      const minterRes = await broadcastTransaction({ transaction: minterTx, network });
      if ('error' in minterRes) {
        console.error(`  Set Minter failed: ${minterRes.error}`);
      } else {
        console.log(`  Set Minter tx: ${minterRes.txid}`);
      }
      await new Promise(r => setTimeout(r, 3000));

      // 3. Set Burner
      console.log(`  Sending set-burner...`);
      const burnerTx = await makeContractCall({
        contractAddress: address,
        contractName: contractName,
        functionName: 'set-burner',
        functionArgs: [
          principalCV(swapContract),
          boolCV(true)
        ],
        senderKey: privateKey,
        network,
        postConditionMode: PostConditionMode.Allow
      });
      const burnerRes = await broadcastTransaction({ transaction: burnerTx, network });
      if ('error' in burnerRes) {
        console.error(`  Set Burner failed: ${burnerRes.error}`);
      } else {
        console.log(`  Set Burner tx: ${burnerRes.txid}`);
      }
      await new Promise(r => setTimeout(r, 3000));

    } catch (e) {
      console.error(`Failed to initialize ${token.symbol}:`, e);
    }
  }
}

run();
