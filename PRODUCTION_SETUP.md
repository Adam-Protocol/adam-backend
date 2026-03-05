# Production Setup Guide

This guide walks you through the critical production setup tasks for Adam Protocol.

## Prerequisites

- Contracts deployed to Starknet Sepolia
- Backend `.env` file configured with contract addresses
- `sncast` CLI tool installed
- Starknet account configured (`caxtonstone1`)

## Quick Setup (Automated)

Run the automated production setup script:

```bash
cd adam-backend
pnpm run production-setup
```

This will:
1. Grant all necessary roles to contracts
2. Verify all roles are configured correctly
3. Test the exchange rate endpoint

## Manual Setup (Step by Step)

### 1. Configure ExchangeRate API Key

Get a free API key from https://www.exchangerate-api.com/

Edit `adam-backend/.env`:
```env
EXCHANGE_RATE_API_KEY=your_actual_key_here
```

### 2. Grant Contract Roles

The RATE_SETTER_ROLE is already granted during deployment. To grant MINTER and BURNER roles:

```bash
cd adam-backend
pnpm run setup-roles
```

This grants:
- MINTER_ROLE to AdamSwap on ADUSD token
- BURNER_ROLE to AdamSwap on ADUSD token
- MINTER_ROLE to AdamSwap on ADNGN token
- BURNER_ROLE to AdamSwap on ADNGN token
- Sets swap_contract on AdamPool

### 3. Verify All Roles

```bash
pnpm run verify-roles-sncast
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

### 4. Test Exchange Rate Endpoint

Start the backend:
```bash
pnpm run start:dev
```

Test the rate endpoint:
```bash
curl http://localhost:4000/swap/rate
```

Expected response:
```json
{
  "rate": 1650.50,
  "timestamp": "2026-03-05T..."
}
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Production Setup | `pnpm run production-setup` | Run all setup tasks automatically |
| Setup Roles | `pnpm run setup-roles` | Grant all necessary roles to contracts |
| Verify Roles | `pnpm run verify-roles-sncast` | Verify all roles are configured |
| Grant Rate Setter | `pnpm run grant-rate-setter` | Grant RATE_SETTER_ROLE (already done in deployment) |

## Troubleshooting

### Role Grant Failed

If role granting fails with "Caller is missing role":
- Ensure you're using the deployer account (`caxtonstone1`)
- Verify the account has DEFAULT_ADMIN_ROLE on the contracts
- Check that contract addresses in `.env` are correct

### Rate Endpoint Returns Error

If the rate endpoint fails:
- Verify EXCHANGE_RATE_API_KEY is set correctly
- Check that the API key is valid at https://www.exchangerate-api.com/
- Ensure backend is running: `pnpm run start:dev`
- Check backend logs for errors

### RPC "Invalid block id" Error

The TypeScript scripts may fail with "Invalid block id" errors due to RPC provider limitations. Use the bash scripts instead:
- Use `pnpm run setup-roles` instead of manual TypeScript scripts
- Use `pnpm run verify-roles-sncast` instead of `pnpm run verify-roles`

## Production Checklist

- [ ] ExchangeRate API key configured
- [ ] All contract roles granted
- [ ] All roles verified
- [ ] Exchange rate endpoint tested
- [ ] Backend running without errors
- [ ] Database migrations applied
- [ ] Redis running for BullMQ

## Next Steps

After completing this setup:
1. Review `PRODUCTION_READINESS_REPORT.md`
2. Complete remaining items in `PRODUCTION_ACTION_CHECKLIST.md`
3. Test all API endpoints
4. Deploy frontend application
