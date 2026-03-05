# Flutterwave Integration Testing Guide

## Overview

This guide provides step-by-step instructions for testing the Flutterwave integration in the Adam Protocol backend.

## Prerequisites

1. **Node.js** and **pnpm** installed
2. **PostgreSQL** and **Redis** running
3. **Flutterwave test account** (sandbox credentials)
4. **ngrok** installed (for webhook testing)

## Step 1: Start the Backend Server

```bash
# 1. Start infrastructure
docker compose up -d postgres redis

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
pnpm prisma:generate

# 4. Run migrations
pnpm prisma:migrate

# 5. Start development server
pnpm start:dev
```

The server should start at `http://localhost:4000`

## Step 2: Test Basic Functionality

Run the comprehensive test script:

```bash
./test-flutterwave-integration.sh
```

This will test:
- Server connectivity
- Rate endpoints
- Rate source switching
- Flutterwave configuration
- Webhook endpoint
- Offramp status endpoint

## Step 3: Test Flutterwave Sandbox

### 3.1 Get Flutterwave Test Credentials

1. Go to [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Sign up for a test account
3. Navigate to Settings > API Keys
4. Copy your test credentials:
   - Public Key: `FLWPUBK_TEST-...`
   - Secret Key: `FLWSECK_TEST-...`
   - Encryption Key: `FLWSECK_TEST...`

### 3.2 Update Environment Variables

Update your `.env` file with test credentials:

```bash
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-your_test_public_key
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your_test_secret_key
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TEST-your_test_encryption_key
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_test_webhook_secret
```

### 3.3 Test Flutterwave API Connectivity

```bash
# Test rate source switching to Flutterwave
curl -X PUT http://localhost:4000/swap/rate/source \
  -H "Content-Type: application/json" \
  -d '{"source": "flutterwave"}'

# Get rate from Flutterwave
curl http://localhost:4000/swap/rate
```

## Step 4: Test Webhooks with ngrok

### 4.1 Start ngrok

```bash
# Install ngrok if not already installed
# For Ubuntu/Debian:
sudo snap install ngrok

# Start ngrok
ngrok http 4000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

### 4.2 Configure Flutterwave Webhook

1. Go to Flutterwave Dashboard
2. Navigate to Settings > Webhooks
3. Add new webhook:
   - URL: `https://abc123.ngrok.io/offramp/webhook`
   - Secret: `Manofgod123.` (or your custom secret)
   - Events: Select all transfer events

### 4.3 Test Webhook Locally

```bash
# Run the webhook test script
./test-webhook.sh
```

This will test:
- Valid signature verification
- Invalid signature rejection
- All event types (completed, failed, reversed)

## Step 5: Test Bank Transfer Flow

### 5.1 Create Test Transaction

First, create a sell transaction in the database:

```bash
# You can use the Prisma Studio to create a test transaction
pnpm prisma:studio
```

Or create via API:

```bash
# This is a simplified example - adjust based on your actual API
curl -X POST http://localhost:4000/token/sell \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x123...",
    "token_in": "adngn",
    "amount": "1000000000000000000",
    "nullifier": "0x456...",
    "commitment": "0x789...",
    "currency": "NGN",
    "bank_account": "0123456789",
    "bank_code": "044"
  }'
```

### 5.2 Test Bank Transfer Initiation

The bank transfer will be initiated automatically when the ChainTxProcessor processes the sell transaction. Monitor the server logs:

```bash
# Check server logs for transfer initiation
tail -f logs/server.log
```

Look for messages like:
- `Flutterwave transfer initiated: ADAM-{transactionId}-{timestamp}`
- `Flutterwave authentication successful`
- Any error messages

### 5.3 Test Webhook Processing

When Flutterwave processes the transfer, it will send a webhook to your ngrok URL. Monitor the server logs for webhook processing:

```bash
# Check for webhook processing
grep -i "webhook" logs/server.log
```

## Step 6: Test Rate Source Fallback

### 6.1 Test Primary Source Failure

```bash
# Temporarily break ExchangeRate-API connection
# (You can do this by setting an invalid API key)

# Switch to ExchangeRate-API
curl -X PUT http://localhost:4000/swap/rate/source \
  -H "Content-Type: application/json" \
  -d '{"source": "exchange_rate_api"}'

# The system should automatically fall back to Flutterwave
# Check logs for fallback messages
```

### 6.2 Test Flutterwave Source Failure

```bash
# Temporarily break Flutterwave connection
# (You can do this by setting an invalid secret key)

# Switch to Flutterwave
curl -X PUT http://localhost:4000/swap/rate/source \
  -H "Content-Type: application/json" \
  -d '{"source": "flutterwave"}'

# The system should automatically fall back to ExchangeRate-API
# Check logs for fallback messages
```

## Step 7: Monitor and Verify

### 7.1 Check Database Updates

```bash
# Use Prisma Studio to monitor transaction status
pnpm prisma:studio
```

Verify that:
- Transaction status updates correctly
- Reference IDs are stored
- Error messages are recorded when transfers fail

### 7.2 Check Logs

```bash
# Monitor all logs
tail -f logs/*.log

# Search for specific patterns
grep -i "flutterwave" logs/server.log
grep -i "webhook" logs/server.log
grep -i "transfer" logs/server.log
```

## Step 8: Production Testing

### 8.1 Update to Production Credentials

```bash
# Update .env file with production credentials
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-... (remove _TEST)
FLUTTERWAVE_SECRET_KEY=FLWSECK-... (remove _TEST)
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK-... (remove _TEST)
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_production_secret
```

### 8.2 Test with Small Amounts

Start with small test amounts (e.g., 100 NGN) to verify:
- Transfer initiation works
- Webhooks are received
- Transaction status updates correctly

### 8.3 Monitor Error Rates

Track:
- Transfer success rate
- Webhook delivery rate
- Authentication failures
- Rate fetch failures

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check API keys are correct
   - Verify keys are not expired
   - Check network connectivity to Flutterwave

2. **Webhook Not Received**
   - Verify ngrok is running
   - Check webhook URL in Flutterwave dashboard
   - Verify webhook secret matches
   - Check server logs for incoming requests

3. **Transfer Failed**
   - Check bank account details
   - Verify sufficient balance
   - Check transfer limits
   - Review error messages in logs

4. **Rate Fetch Failed**
   - Check API key validity
   - Verify network connectivity
   - Check fallback mechanism is working

### Debug Commands

```bash
# Check server status
curl http://localhost:4000

# Check rate endpoints
curl http://localhost:4000/swap/rate
curl http://localhost:4000/swap/rate/source

# Test webhook manually
curl -X POST http://localhost:4000/offramp/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: test" \
  -d '{"test": "payload"}'

# Check database connection
pnpm prisma:validate
```

## Success Criteria

The integration is successful when:

1. ✅ Bank transfers can be initiated
2. ✅ Webhooks are received and processed
3. ✅ Transaction status updates correctly
4. ✅ Rate fetching works from both sources
5. ✅ Automatic fallback between rate sources works
6. ✅ Error handling is robust
7. ✅ Logging provides sufficient detail for debugging

## Next Steps After Testing

1. **Load Testing**: Test with multiple concurrent transfers
2. **Security Review**: Verify webhook signature validation
3. **Monitoring Setup**: Configure alerts for failures
4. **Documentation Update**: Update API docs with new endpoints
5. **User Communication**: Inform users of new features

## Support

For issues with:
- **Flutterwave API**: Contact Flutterwave support
- **Integration Code**: Check server logs and error messages
- **Configuration**: Verify environment variables

## References

- [Flutterwave API Documentation](https://developer.flutterwave.com/v3.0.0/docs)
- [Flutterwave Test Credentials](https://developer.flutterwave.com/v3.0.0/docs/testing)
- [ngrok Documentation](https://ngrok.com/docs)
- [Adam Protocol API Documentation](./API.md)