# Adam Protocol Backend

Privacy-first multichain stablecoin API supporting Starknet and Stacks. Handles buy/sell/swap transaction queuing, live exchange rate fetching, and bank offramp via Flutterwave.

## Architecture

```
Request → Controller → Service → BullMQ Queue (Redis)
                                        ↓
                               ChainTxProcessor
                                        ↓
                    ┌───────────────────┴───────────────────┐
                    ↓                                       ↓
         Starknet RPC (account.execute)        Stacks RPC (contract-call)
                    ↓                                       ↓
                    └───────────────────┬───────────────────┘
                                        ↓ (on sell success)
                              Flutterwave Transfer API
```

## Modules

| Module | Endpoints | Description |
|---|---|---|
| `token` | `POST /token/buy`, `POST /token/sell` | Mint/burn stablecoins |
| `swap` | `POST /swap`, `GET /swap/rate`, `GET/PUT /swap/rate/source` | Swap + live rate + rate source management |
| `offramp` | `GET /offramp/status/:ref`, `POST /offramp/webhook` | Bank transfer status (Flutterwave) |
| `activity` | `GET /activity/:wallet` | Paginated tx history |
| `queue` | BullMQ workers | On-chain tx + offramp jobs |

## Queues

| Queue | Jobs | Retries |
|---|---|---|
| `chain-tx` | submit-buy, submit-sell, submit-swap, push-rate | 3 × exponential backoff |
| `offramp` | initiate-transfer | 5 × 10s delay |

## Features

### 🌍 Global Offramp via Flutterwave
- Supports 34+ African countries (not just Nigeria)
- Multiple currencies: NGN, GHS, KES, UGX, TZS, ZAR, and more
- Secure webhook handling with signature verification
- OAuth2 authentication with automatic token refresh

### 📊 Conditional Rate Sources
- **ExchangeRate-API** (default): Free tier, reliable
- **Flutterwave**: Native rates from payment provider
- Automatic fallback between sources
- Runtime switching via API endpoints

### 🔒 Privacy Features (Starknet)
- Transaction amounts never stored in database
- Only commitment hashes and nullifiers on-chain
- Backend is amount-blind for Starknet transactions

### 🔓 Transparent Transactions (Stacks)
- Standard blockchain transparency
- Amounts visible on-chain for regulatory compliance
- Lower computational overhead

## Local Setup

```bash
# 1. Start infra
docker compose up -d postgres redis

# 2. Install deps
pnpm install
pnpm approve-builds   # approve Prisma, NestJS postinstall

# 3. Setup env
cp .env.example .env
# Fill in:
# - STARKNET keys (deployer address/private key)
# - Contract addresses (after deployment)
# - ExchangeRate-API key
# - Flutterwave credentials (public/secret keys, webhook secret)

# 4. Generate Prisma client
pnpm prisma:generate
pnpm prisma:migrate   # runs migrations

# 5. Start dev server
pnpm start:dev
# API: http://localhost:4000
# Swagger: http://localhost:4000/api
```

## Configuration

### Required Environment Variables

See `.env.example` for full list. Key variables:

```bash
# Starknet
STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/...
STARKNET_DEPLOYER_PRIVATE_KEY=0x...
STARKNET_DEPLOYER_ADDRESS=0x...

# Starknet Contracts (from deployment)
STARKNET_ADUSD_ADDRESS=0x...
STARKNET_ADNGN_ADDRESS=0x...
STARKNET_ADAM_SWAP_ADDRESS=0x...
STARKNET_USDC_ADDRESS=0x...

# Stacks
STACKS_NETWORK=testnet
STACKS_RPC_URL=https://api.testnet.hiro.so
STACKS_DEPLOYER_PRIVATE_KEY="your twenty four word mnemonic"
STACKS_DEPLOYER_ADDRESS=ST...

# Stacks Contracts (from deployment)
STACKS_ADUSD_ADDRESS=ST....adam-token-adusd
STACKS_ADNGN_ADDRESS=ST....adam-token-adngn
STACKS_ADAM_SWAP_ADDRESS=ST....adam-swap-v3
STACKS_USDC_ADDRESS=ST....usdcx

# Exchange Rate
EXCHANGE_RATE_API_KEY=your_key

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
FLUTTERWAVE_WEBHOOK_SECRET_HASH=...
APP_URL=https://your-domain.com
```

## Migration from Monnify

See [FLUTTERWAVE_MIGRATION.md](./FLUTTERWAVE_MIGRATION.md) for detailed migration guide.

## API Documentation

See [API.md](./API.md) for complete endpoint reference.
