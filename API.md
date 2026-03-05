# Adam Protocol API Reference

Base URL: `http://localhost:4000` (dev) | `https://api.adamprotocol.xyz` (prod)

All endpoints return JSON. All amounts in **wei** (USDC: 6 decimals, ADUSD/ADNGN: 18 decimals).

---

## Token

### `POST /token/buy`

Mint ADUSD or ADNGN by depositing USDC.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `wallet` | `string` | ✓ | Starknet wallet address |
| `amount_in` | `string` | ✓ | USDC amount in wei (6 decimals) |
| `token_out` | `"adusd"` \| `"adngn"` | ✓ | Token to receive |
| `commitment` | `string` | ✓ | Pedersen commitment, computed client-side |

**Response** `202`

```json
{ "job_id": "string", "transaction_id": "uuid", "status": "pending" }
```

---

### `POST /token/sell`

Burn ADUSD/ADNGN and trigger a bank transfer.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `wallet` | `string` | ✓ | Starknet wallet address |
| `token_in` | `"adusd"` \| `"adngn"` | ✓ | Token to burn |
| `amount` | `string` | ✓ | Amount in wei (18 decimals) |
| `nullifier` | `string` | ✓ | Nullifier hash, derived client-side |
| `commitment` | `string` | ✓ | Commitment hash |
| `currency` | `"NGN"` \| `"USD"` | ✓ | Fiat output currency |
| `bank_account` | `string` | ✓ | 10-digit account number |
| `bank_code` | `string` | ✓ | Bank code (e.g. `"044"`) |

**Response** `202`

```json
{ "job_id": "string", "transaction_id": "uuid", "status": "pending" }
```

---

## Swap

### `POST /swap`

Swap ADUSD ↔ ADNGN at the live exchange rate.

**Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `wallet` | `string` | ✓ | Starknet wallet address |
| `token_in` | `"adusd"` \| `"adngn"` | ✓ | Token to swap from |
| `amount_in` | `string` | ✓ | Amount in wei (18 decimals) |
| `token_out` | `"adusd"` \| `"adngn"` | ✓ | Token to receive |
| `min_amount_out` | `string` | ✓ | Minimum output (slippage) |
| `commitment` | `string` | ✓ | New commitment for output |

**Response** `202`

```json
{ "job_id": "string", "transaction_id": "uuid", "status": "pending" }
```

---

### `GET /swap/rate`

Get the live USD/NGN rate (cached, refreshed every 5 min).

**Response** `200`

```json
{ "usd_ngn": 1612.45, "updated_at": "2026-02-22T20:00:00.000Z", "source": "exchange_rate_api" }
```

---

### `GET /swap/rate/source`

Get the current default rate source.

**Response** `200`

```json
{ "source": "exchange_rate_api" }
```

---

### `PUT /swap/rate/source`

Set the default rate source for exchange rates.

**Body**

```json
{ "source": "exchange_rate_api" }
```

Valid sources: `exchange_rate_api`, `flutterwave`

**Response** `200`

```json
{ "source": "flutterwave", "message": "Default rate source set to flutterwave" }
```

---

## Offramp

### `GET /offramp/status/:referenceId`

Check status of a bank transfer by its Flutterwave reference ID.

**Response** `200`

```json
{
  "id": "uuid",
  "status": "processing",
  "type": "sell",
  "currency": "NGN",
  "token_in": "ADNGN",
  "token_out": "FIAT",
  "created_at": "...",
  "updated_at": "..."
}
```

---

### `POST /offramp/webhook`

Flutterwave payment webhook (internal — not for client use).

**Headers**: `verif-hash` - Flutterwave webhook signature

**Body**: Raw Flutterwave webhook payload including event type and data.

**Response** `200` `{ "status": "success" }`

---

## Activity

### `GET /activity/:wallet`

Paginated transaction history for a Starknet wallet.

**Query Params**

| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max 100) |
| `type` | `"all"` | Filter: `buy`, `sell`, `swap`, or `all` |

**Response** `200`

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "buy",
      "token_in": "USDC",
      "token_out": "ADUSD",
      "status": "completed",
      "tx_hash": "0x...",
      "reference_id": null,
      "currency": null,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  }
}
```

> **Privacy Notice**: `amount`, `bank_account` are never returned by any endpoint.

---

## Error Format

```json
{ "statusCode": 400, "message": "Commitment already registered", "error": "Bad Request" }
```

| Code | Reason |
|---|---|
| 400 | Invalid input (validation), commitment/nullifier already used |
| 404 | Transaction or reference not found |
| 500 | On-chain execution failed |
