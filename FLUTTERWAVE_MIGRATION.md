# Flutterwave Migration Guide

## Overview

This document outlines the migration from Monnify to Flutterwave as the offramp payment provider for Adam Protocol. Flutterwave provides global reach beyond Nigeria, supporting multiple African countries and currencies.

## Why Flutterwave?

- **Global Reach**: Supports 34+ African countries vs Monnify's Nigeria-only service
- **Multiple Currencies**: NGN, GHS, KES, UGX, TZS, ZAR, and more
- **Better API**: Modern REST API with comprehensive documentation
- **Webhook Security**: Built-in signature verification for webhooks
- **Exchange Rates**: Native support for fetching live exchange rates

## Changes Made

### 1. Removed Monnify Integration

**Deleted Files:**
- `src/offramp/offramp.service.ts` (old Monnify service)

**Removed Environment Variables:**
- `MONNIFY_API_KEY`
- `MONNIFY_SECRET_KEY`
- `MONNIFY_BASE_URL`
- `MONNIFY_CONTRACT_CODE`

### 2. Implemented Flutterwave Integration

**New Files:**
- `src/offramp/flutterwave.service.ts` - Comprehensive Flutterwave service
- `src/swap/rate-source.enum.ts` - Rate source enumeration

**Updated Files:**
- `src/offramp/offramp.controller.ts` - Updated to use Flutterwave
- `src/offramp/offramp.module.ts` - Export FlutterwaveService
- `src/queue/chain-tx.processor.ts` - Use Flutterwave for transfers
- `src/swap/swap.service.ts` - Conditional rate sources
- `src/swap/swap.controller.ts` - New rate source endpoints
- `src/swap/swap.module.ts` - Import OfframpModule

### 3. New Features

#### Conditional Rate Sources

The system now supports multiple exchange rate sources with automatic fallback:

- **ExchangeRate-API** (default): Free tier, reliable
- **Flutterwave**: Native rates from payment provider

**New Endpoints:**
- `GET /swap/rate/source` - Get current default rate source
- `PUT /swap/rate/source` - Set default rate source

**Example:**
```bash
# Get current source
curl http://localhost:4000/swap/rate/source

# Set to Flutterwave
curl -X PUT http://localhost:4000/swap/rate/source \
  -H "Content-Type: application/json" \
  -d '{"source": "flutterwave"}'
```

#### Enhanced Webhook Handling

Flutterwave webhooks include signature verification for security:

**Supported Events:**
- `transfer.completed` - Transfer successful
- `transfer.failed` - Transfer failed
- `transfer.reversed` - Transfer reversed/refunded

**Security:**
- HMAC-SHA256 signature verification
- Validates `verif-hash` header against payload

## Configuration

### Required Environment Variables

Add to your `.env` file:

```bash
# Application URL (for webhook callbacks)
APP_URL=https://your-domain.com

# Flutterwave Configuration
FLUTTERWAVE_AUTH_URL=https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token
FLUTTERWAVE_REFRESH_TOKEN_URL=https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token
FLUTTERWAVE_CREATE_VIRTUAL_ACCOUNT_URL=https://api.flutterwave.com/v3/virtual-account-numbers
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-your_public_key
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your_secret_key
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TEST-your_encryption_key
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_webhook_secret
```

### Obtaining Flutterwave Credentials

1. Sign up at [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Navigate to Settings > API Keys
3. Copy your Public Key, Secret Key, and Encryption Key
4. Set up webhook URL: `https://your-domain.com/offramp/webhook`
5. Copy the webhook secret hash

## Implementation Details

### Authentication

Flutterwave uses OAuth2 client credentials flow:

```typescript
// Automatic token management with caching
private async authenticate(): Promise<string> {
  // Returns cached token if still valid
  if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
    return this.accessToken;
  }
  
  // Fetch new token with 5-minute safety margin
  // Token automatically refreshed before expiry
}
```

### Bank Transfer Flow

1. User initiates sell transaction
2. On-chain burn executed via ChainTxProcessor
3. Flutterwave transfer initiated with reference `ADAM-{txId}-{timestamp}`
4. Transaction status set to `processing`
5. Webhook received when transfer completes/fails
6. Transaction status updated to `completed` or `failed`

### Rate Fetching

The system fetches rates every 5 minutes with automatic fallback:

```typescript
// Primary source: ExchangeRate-API (default)
// Fallback: Flutterwave
// If primary fails, automatically uses fallback
// Rate source tracked in response
```

### Webhook Signature Verification

```typescript
private verifyWebhookSignature(payload: any, signature: string): boolean {
  const secretHash = this.config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET_HASH');
  const hash = crypto
    .createHmac('sha256', secretHash)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}
```

## Testing

### Test Bank Transfer

```bash
# Initiate a sell transaction
curl -X POST http://localhost:4000/token/sell \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x...",
    "token_in": "adngn",
    "amount": "1000000000000000000",
    "nullifier": "0x...",
    "commitment": "0x...",
    "currency": "NGN",
    "bank_account": "0123456789",
    "bank_code": "044"
  }'
```

### Test Webhook Locally

Use ngrok to expose your local server:

```bash
ngrok http 4000
# Update FLUTTERWAVE_WEBHOOK_URL in dashboard to ngrok URL
```

### Test Rate Source Switching

```bash
# Check current rate
curl http://localhost:4000/swap/rate

# Switch to Flutterwave
curl -X PUT http://localhost:4000/swap/rate/source \
  -H "Content-Type: application/json" \
  -d '{"source": "flutterwave"}'

# Verify rate source changed
curl http://localhost:4000/swap/rate
# Response includes "source": "flutterwave"
```

## Migration Checklist

- [x] Remove Monnify service and dependencies
- [x] Implement Flutterwave service with OAuth2
- [x] Add webhook signature verification
- [x] Implement conditional rate sources
- [x] Add rate source management endpoints
- [x] Update API documentation
- [x] Update environment configuration
- [ ] Test bank transfers in sandbox
- [ ] Test webhook handling
- [ ] Test rate source switching
- [ ] Update production environment variables
- [ ] Configure Flutterwave webhook URL in dashboard
- [ ] Monitor first production transactions

## Supported Countries

Flutterwave supports transfers in:

- 🇳🇬 Nigeria (NGN)
- 🇬🇭 Ghana (GHS)
- 🇰🇪 Kenya (KES)
- 🇺🇬 Uganda (UGX)
- 🇹🇿 Tanzania (TZS)
- 🇿🇦 South Africa (ZAR)
- And 28+ more African countries

## Error Handling

The implementation includes comprehensive error handling:

- **Authentication Failures**: Logged with details, throws error
- **Transfer Failures**: Transaction marked as failed with error message
- **Webhook Verification Failures**: Logged and rejected
- **Rate Fetch Failures**: Automatic fallback to alternative source
- **Token Expiry**: Automatic refresh with 5-minute safety margin

## Monitoring

Key metrics to monitor:

1. **Transfer Success Rate**: Track completed vs failed transfers
2. **Webhook Delivery**: Monitor webhook receipt and processing
3. **Rate Source Availability**: Track which source is being used
4. **Authentication Failures**: Monitor OAuth token issues
5. **Transaction Processing Time**: From initiation to completion

## Support

For issues or questions:

- Flutterwave Documentation: https://developer.flutterwave.com
- Flutterwave Support: support@flutterwave.com
- Adam Protocol: [Your support channel]

## Next Steps

1. Test thoroughly in sandbox environment
2. Update production environment variables
3. Configure webhook URL in Flutterwave dashboard
4. Monitor first transactions closely
5. Consider implementing retry logic for failed transfers
6. Add transaction status notifications to users
