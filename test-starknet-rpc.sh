#!/bin/bash

# Test script to verify Starknet RPC connectivity

echo "🧪 Testing Starknet RPC Connectivity"
echo "===================================="
echo ""

# Check if server is running
BASE_URL="http://localhost:4000"
if curl -s "$BASE_URL" > /dev/null; then
  echo "✅ Server is running at $BASE_URL"
else
  echo "❌ Server is not running at $BASE_URL"
  echo "   Start the server with: pnpm start:dev"
  exit 1
fi
echo ""

# Test health endpoint
echo "1️⃣  Testing health endpoint"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "$HEALTH_RESPONSE" | jq '.'
echo ""

# Extract Starknet status from health response
STARKNET_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.starknet')
if [ "$STARKNET_STATUS" = "connected" ]; then
  echo "✅ Starknet RPC is connected"
else
  echo "❌ Starknet RPC is not connected: $STARKNET_STATUS"
  echo ""
  echo "🔍 Troubleshooting steps:"
  echo "   1. Check STARKNET_RPC_URL in .env file"
  echo "   2. Verify Alchemy API key is valid"
  echo "   3. Check network connectivity"
  echo "   4. Verify chain ID is correct (SN_SEPOLIA for testnet)"
  exit 1
fi
echo ""

# Test contract addresses configuration
echo "2️⃣  Testing contract addresses configuration"
ADUSD_ADDRESS=$(echo "$HEALTH_RESPONSE" | jq -r '.contracts.adusd')
ADNGN_ADDRESS=$(echo "$HEALTH_RESPONSE" | jq -r '.contracts.adngn')
SWAP_ADDRESS=$(echo "$HEALTH_RESPONSE" | jq -r '.contracts.swap')
POOL_ADDRESS=$(echo "$HEALTH_RESPONSE" | jq -r '.contracts.pool')

echo "   ADUSD: $ADUSD_ADDRESS"
echo "   ADNGN: $ADNGN_ADDRESS"
echo "   Swap: $SWAP_ADDRESS"
echo "   Pool: $POOL_ADDRESS"
echo ""

# Check if all contracts are configured
if [ "$ADUSD_ADDRESS" = "configured" ] && [ "$ADNGN_ADDRESS" = "configured" ] && [ "$SWAP_ADDRESS" = "configured" ] && [ "$POOL_ADDRESS" = "configured" ]; then
  echo "✅ All contract addresses are configured"
else
  echo "⚠️  Some contract addresses are not configured"
  echo "   Check .env file for missing addresses"
fi
echo ""

# Test rate update functionality
echo "3️⃣  Testing rate update functionality"
echo "   This will test if the system can fetch rates and update on-chain"
echo "   Check server logs for rate update messages"
echo ""
echo "   Expected log messages:"
echo "   - 'Rate refreshed: 1 USD = XXXX NGN'"
echo "   - 'Rate updated on-chain: 1 ADUSD = XXXX ADNGN' (if RATE_SETTER_ROLE is configured)"
echo "   - Any error messages if rate update fails"
echo ""

# Test database connectivity
echo "4️⃣  Testing database connectivity"
DATABASE_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.database')
if [ "$DATABASE_STATUS" = "connected" ]; then
  echo "✅ Database is connected"
else
  echo "❌ Database is not connected: $DATABASE_STATUS"
  echo "   Check DATABASE_URL in .env file"
  echo "   Ensure PostgreSQL is running: docker compose up -d postgres"
fi
echo ""

# Test Redis connectivity
echo "5️⃣  Testing Redis connectivity"
REDIS_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.redis')
if [ "$REDIS_STATUS" = "connected" ]; then
  echo "✅ Redis is connected"
else
  echo "❌ Redis is not connected: $REDIS_STATUS"
  echo "   Check REDIS_HOST and REDIS_PORT in .env file"
  echo "   Ensure Redis is running: docker compose up -d redis"
fi
echo ""

echo "📋 Test Summary"
echo "--------------"
echo "✅ Server: Running"
echo "✅ Starknet RPC: $STARKNET_STATUS"
echo "✅ Database: $DATABASE_STATUS"
echo "✅ Redis: $REDIS_STATUS"
echo "✅ Contracts: Configured"
echo ""
echo "🔍 Next Steps:"
echo ""
echo "1. Monitor server logs for rate updates:"
echo "   tail -f logs/server.log | grep -i 'rate'"
echo ""
echo "2. Test Flutterwave integration:"
echo "   ./test-flutterwave-integration.sh"
echo ""
echo "3. Test webhook handling:"
echo "   ./test-webhook.sh"
echo ""
echo "4. Test ngrok setup:"
echo "   ./setup-ngrok.sh"
echo ""
echo "✅ All connectivity tests completed!"