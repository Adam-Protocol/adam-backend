# Exchange Rate Update System

This document explains how the Adam Protocol automatically fetches and updates exchange rates across multiple blockchains.

## Overview

The system fetches real-time exchange rates from external APIs (ExchangeRate-API or Flutterwave) and automatically updates the rates on both Starknet and Stacks smart contracts.

## Architecture

```
┌─────────────────────┐
│  Swap Service       │
│  (Cron: Every 5min) │
└──────────┬──────────┘
           │
           ├─► Fetch rates from API
           │   (ExchangeRate-API or Flutterwave)
           │
           ├─► Cache rates in memory
           │
           └─► Enqueue rate update jobs
               │
               ├─► push-rates (Starknet)
               │   └─► ChainTxProcessor
               │       └─► StarknetService.execute()
               │           └─► set_rate() on contract
               │
               └─► push-rates-stacks (Stacks)
                   └─► ChainTxProcessor
                       └─► StacksService.executeTransaction()
                           └─► set-rate() on contract
```

## Components

### 1. Swap Service (`src/swap/swap.service.ts`)

**Responsibilities:**
- Fetches exchange rates every 5 minutes via cron job
- Supports multiple rate sources (ExchangeRate-API, Flutterwave)
- Caches rates in memory
- Enqueues rate update jobs for both chains

**Key Methods:**
- `refreshRate()`: Cron job that fetches and caches rates
- `getAllRates()`: Returns all cached rates
- `setDefaultRateSource()`: Switch between rate providers

**Supported Currencies:**
- NGN (Nigerian Naira) → ADNGN
- KES (Kenyan Shilling) → ADKES
- GHS (Ghanaian Cedi) → ADGHS
- ZAR (South African Rand) → ADZAR

### 2. Chain Transaction Processor (`src/queue/chain-tx.processor.ts`)

**Responsibilities:**
- Processes queued rate update jobs
- Handles both Starknet and Stacks rate updates
- Manages transaction execution and error handling

**Key Methods:**
- `processMultiCurrencyRateUpdate()`: Updates rates on Starknet
- `processStacksRateUpdate()`: Updates rates on Stacks

### 3. Rate Precision

**Starknet:**
- Uses 18 decimal precision (1e18)
- Example: 1 USD = 1383.05 NGN → `1383050000000000000000`

**Stacks:**
- Uses 6 decimal precision (1e6)
- Example: 1 USD = 1383.05 NGN → `1383050000`

## Configuration

### Environment Variables

**Backend (.env):**
```bash
# Rate API Configuration
EXCHANGE_RATE_API_KEY=your_key_here
EXCHANGE_RATE_API_URL=https://v6.exchangerate-api.com/v6

# Flutterwave (Alternative rate source)
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your_secret_key

# Starknet Configuration
DEPLOYER_PRIVATE_KEY=0x...
DEPLOYER_ADDRESS=0x...
ADAM_SWAP_ADDRESS=0x...
ADUSD_ADDRESS=0x...
ADNGN_ADDRESS=0x...
ADKES_ADDRESS=0x...
ADGHS_ADDRESS=0x...
ADZAR_ADDRESS=0x...

# Stacks Configuration
STACKS_NETWORK=testnet
STACKS_DEPLOYER_PRIVATE_KEY="mnemonic phrase"
STACKS_DEPLOYER_ADDRESS=ST...
STACKS_SWAP_CONTRACT=ST....adam-swap-v3

# Redis (for job queue)
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Stacks Contract (.env):**
```bash
# Initial rates (6 decimal precision)
RATE_USDC_ADUSD="1000000"
RATE_ADUSD_USDC="1000000"
RATE_USDC_ADNGN="1383050000"
RATE_ADNGN_USDC="723"
RATE_USDC_ADKES="129320000"
RATE_ADKES_USDC="7733"
RATE_USDC_ADGHS="10910000"
RATE_ADGHS_USDC="91660"
RATE_USDC_ADZAR="17080000"
RATE_ADZAR_USDC="58548"
```

## Rate Update Flow

### 1. Automatic Updates (Every 5 Minutes)

```typescript
// Triggered by cron job in SwapService
@Cron(CronExpression.EVERY_5_MINUTES)
async refreshRate() {
  // 1. Fetch rates from API
  const rates = await this.fetchFromExchangeRateApi();
  
  // 2. Cache rates
  this.cachedRates.set('NGN', { rate, updated_at, source });
  
  // 3. Enqueue update jobs
  await this.chainTxQueue.add('push-rates', { rates });
  await this.chainTxQueue.add('push-rates-stacks', { rates });
}
```

### 2. Starknet Rate Update

```typescript
// ChainTxProcessor.processMultiCurrencyRateUpdate()
for (const [currency, rate] of Object.entries(rates)) {
  // Convert to 1e18 precision
  const rateBigInt = BigInt(Math.round(rate * 1e18));
  
  // Call set_rate on contract
  await this.starknet.execute([
    {
      contractAddress: swapAddress,
      entrypoint: 'set_rate',
      calldata: [adusdAddress, tokenAddress, rate.low, rate.high]
    }
  ]);
}
```

### 3. Stacks Rate Update

```typescript
// ChainTxProcessor.processStacksRateUpdate()
for (const [currency, rate] of Object.entries(rates)) {
  // Convert to 1e6 precision
  const rateValue = Math.round(rate * 1e6).toString();
  
  // Call set-rate on contract
  await this.stacks.executeTransaction({
    contractAddress: swapContractId,
    functionName: 'set-rate',
    calldata: [
      contractPrincipalCV(deployerAddress, fromContract),
      contractPrincipalCV(deployerAddress, toContract),
      uintCV(rateValue)
    ]
  });
}
```

## Rate Pairs Updated

For each currency (NGN, KES, GHS, ZAR), the system updates:

1. **USDC ↔ AD{CURRENCY}**
   - USDC → ADNGN
   - ADNGN → USDC

2. **ADUSD ↔ AD{CURRENCY}**
   - ADUSD → ADNGN
   - ADNGN → ADUSD

3. **USDC ↔ ADUSD** (1:1)
   - USDC → ADUSD
   - ADUSD → USDC

## Manual Rate Updates

### Update Stacks Rates Manually

```bash
cd adam-contract/stacks
pnpm run update-rates
```

This script:
1. Reads rates from `.env` file
2. Calls `set-rate` on the swap contract for all pairs
3. Waits for transaction confirmation

### Update Starknet Rates Manually

```bash
cd adam-backend
pnpm run set-all-rates
```

## API Endpoints

### Get Current Rates

```bash
GET /swap/rates
```

Response:
```json
{
  "NGN": {
    "rate": 1383.05,
    "updated_at": "2026-03-20T10:30:00Z",
    "source": "EXCHANGE_RATE_API"
  },
  "KES": {
    "rate": 129.32,
    "updated_at": "2026-03-20T10:30:00Z",
    "source": "EXCHANGE_RATE_API"
  }
}
```

### Change Rate Source

```bash
POST /swap/rate-source
Content-Type: application/json

{
  "source": "flutterwave"
}
```

Options: `exchange_rate_api`, `flutterwave`

## Monitoring

### Check Rate Update Status

```bash
# View Redis queue
redis-cli
> LLEN bull:chain-tx:waiting
> LLEN bull:chain-tx:active
> LLEN bull:chain-tx:failed
```

### View Logs

```bash
# Backend logs
tail -f logs/app.log | grep "Rate"

# Look for:
# - "Rate refreshed from..."
# - "Rate updated on-chain..."
# - "Stacks rates updated for..."
```

## Error Handling

### Rate Fetch Failures

If the primary rate source fails, the system automatically falls back to the alternative source:

```typescript
if (this.defaultRateSource === RateSource.FLUTTERWAVE) {
  // Try Flutterwave first
  rates = await this.fetchFromFlutterwave();
  if (!rates) {
    // Fallback to ExchangeRate-API
    rates = await this.fetchFromExchangeRateApi();
  }
}
```

### Transaction Failures

Failed rate update jobs are automatically retried:
- Max attempts: 3
- Backoff: Exponential (1s, 2s, 4s)

### Stale Rates

If rate updates fail, the system continues using cached rates. Monitor the `updated_at` timestamp to detect stale rates.

## Testing

### Test Rate Fetch

```bash
curl http://localhost:4000/swap/rates
```

### Test Manual Rate Update

```bash
# Trigger immediate rate refresh
curl -X POST http://localhost:4000/swap/refresh-rates
```

### Test Rate Source Switch

```bash
curl -X POST http://localhost:4000/swap/rate-source \
  -H "Content-Type: application/json" \
  -d '{"source": "flutterwave"}'
```

## Troubleshooting

### Rates Not Updating

1. Check if cron job is running:
   ```bash
   # Look for "Rate refreshed from..." in logs
   ```

2. Check Redis connection:
   ```bash
   redis-cli ping
   ```

3. Check API keys:
   ```bash
   # Verify EXCHANGE_RATE_API_KEY is valid
   curl "https://v6.exchangerate-api.com/v6/YOUR_KEY/latest/USD"
   ```

### Stacks Transactions Failing

1. Check deployer balance:
   ```bash
   # Ensure deployer has enough STX for gas
   ```

2. Verify contract address:
   ```bash
   # Check STACKS_SWAP_CONTRACT in .env
   ```

3. Check network:
   ```bash
   # Verify STACKS_NETWORK matches deployed contracts
   ```

### Starknet Transactions Failing

1. Check deployer balance:
   ```bash
   # Ensure deployer has enough ETH for gas
   ```

2. Verify contract addresses:
   ```bash
   # Check all token addresses in .env
   ```

## Security Considerations

1. **Private Keys**: Store deployer private keys securely
2. **Rate Manipulation**: Validate rates before updating contracts
3. **Access Control**: Only authorized backend wallet can update rates
4. **Rate Limits**: Respect API rate limits (ExchangeRate-API: 1500 requests/month on free tier)

## Future Improvements

1. Add rate validation (min/max bounds)
2. Implement rate change alerts
3. Add support for more currencies
4. Implement oracle aggregation (multiple sources)
5. Add rate update dashboard
6. Implement emergency rate freeze mechanism
