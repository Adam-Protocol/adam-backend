import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WALLET_ADDRESS = '0x0456e6d7184cd79e3f5cc63397a5540e8aeef7fd2f136136dfd40caf122cba88';

async function main() {
  console.log('Seeding activity data...');

  // Create sample transactions for the wallet
  const activities = [
    {
      wallet: WALLET_ADDRESS,
      type: 'buy',
      commitment: '0xabc123def456789012345678901234567890123456789012345678901234567890',
      nullifier: '0x1111111111111111111111111111111111111111111111111111111111111111',
      token_in: 'NGN',
      token_out: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
      status: 'completed',
      tx_hash: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      reference_id: 'FLW-REF-001',
      currency: 'NGN',
      bank_account: '1234567890',
      bank_code: '044',
      created_at: new Date('2026-03-01T10:30:00Z'),
    },
    {
      wallet: WALLET_ADDRESS,
      type: 'swap',
      commitment: '0xdef456789012345678901234567890123456789012345678901234567890abcd',
      nullifier: '0x2222222222222222222222222222222222222222222222222222222222222222',
      token_in: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
      token_out: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // USDC
      status: 'completed',
      tx_hash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      created_at: new Date('2026-03-02T14:15:00Z'),
    },
    {
      wallet: WALLET_ADDRESS,
      type: 'sell',
      commitment: '0x789012345678901234567890123456789012345678901234567890abcdef456',
      nullifier: '0x3333333333333333333333333333333333333333333333333333333333333333',
      token_in: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // USDC
      token_out: 'NGN',
      status: 'completed',
      tx_hash: '0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123',
      reference_id: 'FLW-REF-002',
      currency: 'NGN',
      bank_account: '1234567890',
      bank_code: '044',
      created_at: new Date('2026-03-03T09:45:00Z'),
    },
    {
      wallet: WALLET_ADDRESS,
      type: 'buy',
      commitment: '0x234567890123456789012345678901234567890123456789abcdef456789012',
      token_in: 'NGN',
      token_out: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // USDC
      status: 'processing',
      reference_id: 'FLW-REF-003',
      currency: 'NGN',
      bank_account: '1234567890',
      bank_code: '044',
      created_at: new Date('2026-03-05T16:20:00Z'),
    },
    {
      wallet: WALLET_ADDRESS,
      type: 'swap',
      commitment: '0x567890123456789012345678901234567890abcdef456789012345678901234',
      token_in: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // USDC
      token_out: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
      status: 'pending',
      created_at: new Date('2026-03-06T08:10:00Z'),
    },
    {
      wallet: WALLET_ADDRESS,
      type: 'buy',
      commitment: '0x890123456789012345678901234567890abcdef456789012345678901234567',
      token_in: 'NGN',
      token_out: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
      status: 'failed',
      reference_id: 'FLW-REF-004',
      currency: 'NGN',
      error: 'Payment timeout',
      created_at: new Date('2026-03-04T11:30:00Z'),
    },
  ];

  for (const activity of activities) {
    await prisma.transaction.create({
      data: activity,
    });
    console.log(`Created ${activity.type} transaction: ${activity.commitment}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
