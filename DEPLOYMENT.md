# Adam Backend Deployment Guide

## Prerequisites

1. **Contracts deployed** - Run contract deployment first
2. **PostgreSQL** - Database running and accessible
3. **Redis** - Required for BullMQ job queue
4. **Node.js** - v18+ with pnpm installed
5. **Environment variables** - `.env` file configured

---

## Step 1: Install Dependencies

```bash
cd adam-backend
pnpm install
```

---

## Step 2: Configure Environment

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

### Critical Variables

```env
# Contract addresses (from adam-contract/scripts/deployment.json)
ADUSD_ADDRESS=0x...
ADNGN_ADDRESS=0x...
ADAM_SWAP_ADDRESS=0x...
ADAM_POOL_ADDRESS=0x...
USDC_ADDRESS=0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8

# Starknet
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
DEPLOYER_ADDRESS=0x...
DEPLOYER_PRIVATE_KEY=0x...

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/adam_protocol"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys
EXCHANGE_RATE_API_KEY=your_key_here
MONNIFY_API_KEY=your_key_here
MONNIFY_SECRET_KEY=your_secret_here
```

---

## Step 3: Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

## Step 4: Grant Rate Setter Role

The backend needs `RATE_SETTER_ROLE` to update exchange rates on-chain:

```bash
pnpm run grant-rate-setter
```

Expected output:
```
Granting RATE_SETTER_ROLE to backend wallet...
Swap Contract: 0x...
Backend Wallet: 0x...
Transaction submitted: 0x...
✅ RATE_SETTER_ROLE granted successfully!
```

---

## Step 5: Verify Role Configuration

```bash
pnpm run verify-roles
```

Expected output:
```
=== Role Verification ===

ADUSD Token:
  MINTER_ROLE (AdamSwap): ✅
  BURNER_ROLE (AdamSwap): ✅

ADNGN Token:
  MINTER_ROLE (AdamSwap): ✅
  BURNER_ROLE (AdamSwap): ✅

AdamSwap:
  RATE_SETTER_ROLE (Backend): ✅

AdamPool:
  swap_contract set to AdamSwap: ✅

=== Summary ===
✅ All roles configured correctly!
```

---

## Step 6: Start Services

### Development Mode

```bash
pnpm run start:dev
```

### Production Mode

```bash
# Build
pnpm run build

# Start
pnpm run start:prod
```

---

## Step 7: Health Check

Verify the backend is running:

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-03T...",
  "database": "connected",
  "redis": "connected",
  "starknet": "connected",
  "contracts": {
    "adusd": "deployed",
    "adngn": "configured",
    "swap": "deployed",
    "pool": "configured"
  }
}
```

---

## Step 8: Test API Endpoints

### Get Exchange Rate

```bash
curl http://localhost:4000/swap/rate
```

Expected:
```json
{
  "usd_ngn": 1612.45,
  "updated_at": "2026-03-03T..."
}
```

### Test Buy (requires wallet with USDC)

```bash
curl -X POST http://localhost:4000/token/buy \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x...",
    "amount_in": "1000000",
    "token_out": "adusd",
    "commitment": "0x123..."
  }'
```

---

## Monitoring

### Check BullMQ Queue

```bash
# Connect to Redis
redis-cli

# Check pending jobs
LLEN bull:chain-tx:wait

# Check failed jobs
LLEN bull:chain-tx:failed
```

### Check Logs

```bash
# Development
# Logs appear in console

# Production (with PM2)
pm2 logs adam-backend
```

### Check Database

```bash
# Connect to database
psql $DATABASE_URL

# Check recent transactions
SELECT id, type, status, created_at FROM "Transaction" ORDER BY created_at DESC LIMIT 10;
```

---

## Troubleshooting

### Rate Updates Not Working

**Symptom:** Logs show "Rate refresh failed" or no rate updates

**Solutions:**
1. Check ExchangeRate-API key is valid
2. Verify `RATE_SETTER_ROLE` is granted: `pnpm run verify-roles`
3. Check Starknet RPC is accessible

### Transactions Stuck in "pending"

**Symptom:** Transactions never move to "processing" or "completed"

**Solutions:**
1. Check Redis is running: `redis-cli ping`
2. Check BullMQ worker is processing: Look for "Processing chain-tx job" in logs
3. Check Starknet RPC connection: `curl $STARKNET_RPC_URL`

### Database Connection Failed

**Symptom:** "database: disconnected" in health check

**Solutions:**
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` is correct
3. Run migrations: `npx prisma migrate deploy`

### Contract Calls Failing

**Symptom:** "On-chain execution failed" errors

**Solutions:**
1. Verify contract addresses in `.env` match deployment
2. Check deployer wallet has enough ETH for gas
3. Verify roles are configured: `pnpm run verify-roles`

---

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Redis running and accessible
- [ ] Rate setter role granted
- [ ] All roles verified
- [ ] Health check returns "ok"
- [ ] Rate updates working (check logs every 5 minutes)
- [ ] Test buy/sell/swap transactions successful
- [ ] Monnify webhook configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place

---

## Next Steps

1. Set up monitoring (e.g., Datadog, New Relic)
2. Configure Monnify webhook URL
3. Set up automated backups for PostgreSQL
4. Configure rate limiting and DDoS protection
5. Set up SSL/TLS certificates
6. Configure CORS for frontend domain
