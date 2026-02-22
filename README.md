# Adam Protocol Backend

Privacy-first stablecoin API on Starknet. Handles buy/sell/swap transaction queuing, live NGN rate fetching, and bank offramp via Monnify.

## Architecture

```
Request → Controller → Service → BullMQ Queue (Redis)
                                        ↓
                               ChainTxProcessor
                                        ↓
                         Starknet RPC (account.execute)
                                        ↓ (on sell success)
                               Monnify Transfer API
```

## Modules

| Module | Endpoints | Description |
|---|---|---|
| `token` | `POST /token/buy`, `POST /token/sell` | Mint/burn stablecoins |
| `swap` | `POST /swap`, `GET /swap/rate` | Swap + live rate |
| `offramp` | `GET /offramp/status/:ref`, `POST /offramp/webhook` | Bank transfer status |
| `activity` | `GET /activity/:wallet` | Paginated tx history |
| `queue` | BullMQ workers | On-chain tx + offramp jobs |

## Queues

| Queue | Jobs | Retries |
|---|---|---|
| `chain-tx` | submit-buy, submit-sell, submit-swap, push-rate | 3 × exponential backoff |
| `offramp` | initiate-transfer | 5 × 10s delay |

## Local Setup

```bash
# 1. Start infra
docker compose up -d postgres redis

# 2. Install deps
pnpm install
pnpm approve-builds   # approve Prisma, NestJS postinstall

# 3. Setup env
cp .env.example .env
# Fill in STARKNET keys and ExchangeRate-API key

# 4. Generate Prisma client
pnpm prisma:generate
pnpm prisma:migrate   # runs migrations

# 5. Start dev server
pnpm start:dev
# API: http://localhost:4000
# Swagger: http://localhost:4000/api
```

## Privacy

Transaction **amounts are never stored** in the database or logged. Only commitment hashes and nullifiers appear on-chain. The backend is amount-blind.
