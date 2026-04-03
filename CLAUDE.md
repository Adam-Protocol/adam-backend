# adam-backend — Claude Context

## What This Is

NestJS 11 REST API that serves as the **chain-agnostic backend** for Adam Protocol. It:
- Accepts buy / sell / swap requests from the frontend
- Validates and enqueues blockchain transactions (BullMQ)
- Processes on-chain submissions via chain-specific adapters
- Manages exchange rate updates (scheduled)
- Records activity history in PostgreSQL

The API is chain-agnostic at the controller/service layer; chain calls are isolated in `StarknetModule` and `StacksModule`.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| NestJS 11 | Framework |
| TypeScript 5 | Language |
| Prisma 6 | ORM (PostgreSQL) |
| BullMQ 5 + Redis | Async job queue |
| `@nestjs/schedule` | Cron jobs (rate updates) |
| `@nestjs/swagger` | API docs |
| starknet.js 9 | Starknet chain calls |
| `@stacks/transactions` | Stacks chain calls |
| Axios | HTTP (exchange-rate APIs, Flutterwave) |
| Jest + Supertest | Testing |

---

## Module Structure

```
src/
├── main.ts                     # Bootstrap: CORS, ValidationPipe, Swagger
├── app.module.ts               # Root module — wires all modules
├── app.controller.ts           # GET / (health check)
├── app.service.ts              # Startup checks, rate kick-off
│
├── token/                      # Buy & sell endpoints
│   ├── token.controller.ts     # POST /token/buy, POST /token/sell
│   ├── token.service.ts        # Validates, creates DB record, enqueues job
│   └── dto/                    # Request/response DTOs
│
├── swap/                       # Swap & rate endpoints
│   ├── swap.controller.ts      # POST /swap, GET /swap/rate
│   ├── swap.service.ts         # Fetches live rate, enqueues swap job
│   └── dto/
│
├── activity/                   # Transaction history
│   ├── activity.controller.ts  # GET /activity/:wallet
│   └── activity.service.ts     # Paginated DB query
│
├── offramp/                    # Flutterwave integration
│   ├── offramp.service.ts      # Initiate bank transfer for sell
│   └── dto/
│
├── queue/                      # BullMQ processors
│   ├── queue.module.ts         # Registers "chain-tx" queue
│   └── chain-tx.processor.ts   # Dequeues jobs → dispatches to chain adapter
│
├── starknet/                   # Starknet chain adapter
│   ├── starknet.module.ts
│   ├── starknet.service.ts     # Contract calls (buy, sell, swap, approve)
│   └── starknet-event.service.ts # On-chain event listener
│
├── stacks/                     # Stacks chain adapter
│   ├── stacks.module.ts
│   └── stacks.service.ts       # Clarity contract calls
│
├── prisma/                     # Prisma module + service
│   ├── prisma.module.ts
│   └── prisma.service.ts       # PrismaClient singleton
│
├── common/                     # Shared utilities
│   └── common.module.ts
│
└── scripts/                    # Bash/TS utility scripts
    ├── grant-rate-setter.sh
    ├── verify-roles.sh
    ├── setup-roles.sh
    └── test-rate-update.ts
```

---

## Database (Prisma)

Schema is in `prisma/schema.prisma`. Key tables:

| Model | Purpose |
|---|---|
| `Transaction` | Every buy/sell/swap record (status, chain, job_id, wallet) |
| `Commitment` | Starknet commitments for privacy (nullifier tracking) |
| `ExchangeRate` | Cached USD/NGN rates with timestamps |

```bash
# Common Prisma commands
pnpm prisma:migrate       # Apply dev migrations
pnpm prisma:migrate:deploy # Apply to production DB
pnpm prisma:generate       # Regenerate client after schema changes
pnpm prisma:studio         # Database GUI at :5555
pnpm prisma:seed           # Seed initial data
```

> **Always run `pnpm prisma:generate` after modifying `schema.prisma`.**

---

## Queue Architecture

All blockchain writes go through BullMQ:

```
API Controller → Service (creates Transaction record + enqueues job)
                          ↓
              chain-tx queue (Redis)
                          ↓
              chain-tx.processor.ts
                 ↙               ↘
    StarknetService          StacksService
         ↓                        ↓
  On-chain TX               On-chain TX
         ↓                        ↓
  DB status update          DB status update
```

- Queue name: `"chain-tx"`
- Job payload contains: `{ type, chain, wallet, amount, token, commitment?, ... }`
- Failed jobs are retried automatically (BullMQ defaults). Monitor with:
  ```bash
  redis-cli LLEN bull:chain-tx:wait
  redis-cli LLEN bull:chain-tx:failed
  ```

---

## Chain Adapters

**Rule**: Never call `starknet.js` or `@stacks/*` outside of `StarknetModule` / `StacksModule`. All other services must inject `StarknetService` or `StacksService`.

### StarknetService key methods
- `buyToken(wallet, amount, token, commitment)`
- `sellToken(wallet, token, amount, nullifier, commitment)`
- `swapTokens(wallet, tokenIn, amountIn, tokenOut, minAmountOut, commitment)`
- `listenForEvents()` — called on startup

### StacksService key methods
- `buyToken(wallet, amount, token)`
- `sellToken(wallet, token, amount)`
- `swapTokens(wallet, tokenIn, amountIn, tokenOut)`

---

## Exchange Rate System

See `RATE_UPDATE_SYSTEM.md` for full details.

- `AppService` schedules rate fetches via `@nestjs/schedule`.
- Rate is cached in the `ExchangeRate` table.
- `GET /swap/rate` reads from the cache (never calls the exchange API synchronously).
- To grant the rate-setter role on-chain:
  ```bash
  pnpm run grant-rate-setter
  ```

---

## Key Conventions

1. **DTOs everywhere**: All controller inputs must use `class-validator` DTOs. No raw body access.
2. **Chain isolation**: Chain SDK code belongs exclusively in `src/starknet/` or `src/stacks/`. If you need a chain call from another module, create a method in the chain service and inject it.
3. **Async transactions**: No controller should await a blockchain TX. Enqueue the job and return a `job_id`.
4. **DatabaseFirst**: Always write a `Transaction` DB record before enqueuing. Status flow: `pending → processing → completed | failed`.
5. **Environment Config**: Access env vars only via `ConfigService` (NestJS) or `process.env` with a fallback. No bare `process.env.FOO` without defaults in critical paths.
6. **Decimal precision**: All token amounts stored in the DB and sent to contracts are in **base units (10^6 for 6-decimal tokens)**. Never store human-readable amounts.

---

## Dev Commands

```bash
pnpm start:dev            # Watch mode on :4000
pnpm start:debug          # Debug mode
pnpm build                # Compile to dist/
pnpm start:prod           # Run compiled output

pnpm test                 # Unit tests
pnpm test:e2e             # End-to-end tests
pnpm test:cov             # Coverage report

pnpm run verify-roles     # Check on-chain role assignments
pnpm run setup-roles      # Grant all required roles
pnpm run grant-rate-setter

pnpm format               # Prettier
pnpm lint                 # ESLint --fix
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/adam

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # optional

# Starknet
STARKNET_RPC_URL=
STARKNET_DEPLOYER_PRIVATE_KEY=
STARKNET_DEPLOYER_ADDRESS=
STARKNET_ADUSD_ADDRESS=
STARKNET_ADNGN_ADDRESS=
STARKNET_ADAM_SWAP_ADDRESS=
STARKNET_USDC_ADDRESS=

# Stacks
STACKS_NETWORK=testnet
STACKS_RPC_URL=
STACKS_DEPLOYER_PRIVATE_KEY=
STACKS_ADUSD_ADDRESS=
STACKS_ADAM_SWAP_ADDRESS=

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=

# Exchange Rate
EXCHANGE_RATE_API_KEY=
```

---

## Adding a New Endpoint

1. Create a DTO in `src/<module>/dto/`.
2. Add method to the relevant service (`token.service.ts`, `swap.service.ts`, etc.).
3. Add route to the controller with `@ApiOperation` decorator for Swagger.
4. If the operation touches the chain: enqueue a job with the chain-tx processor, don't call the chain service directly.
5. Write a unit test in `src/<module>/<module>.service.spec.ts`.
