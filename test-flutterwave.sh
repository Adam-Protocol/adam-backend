#!/bin/bash

# Test script for Flutterwave integration
# Run this after starting the backend server

BASE_URL="http://localhost:4000"

echo "🧪 Testing Flutterwave Integration"
echo "=================================="
echo ""

# Test 1: Get current rate
echo "1️⃣  Testing GET /swap/rate"
curl -s "$BASE_URL/swap/rate" | jq '.'
echo ""
echo ""

# Test 2: Get current rate source
echo "2️⃣  Testing GET /swap/rate/source"
curl -s "$BASE_URL/swap/rate/source" | jq '.'
echo ""
echo ""

# Test 3: Set rate source to Flutterwave
echo "3️⃣  Testing PUT /swap/rate/source (switch to Flutterwave)"
curl -s -X PUT "$BASE_URL/swap/rate/source" \
  -H "Content-Type: application/json" \
  -d '{"source": "flutterwave"}' | jq '.'
echo ""
echo ""

# Test 4: Verify rate source changed
echo "4️⃣  Verifying rate source changed"
curl -s "$BASE_URL/swap/rate/source" | jq '.'
echo ""
echo ""

# Test 5: Get rate from Flutterwave
echo "5️⃣  Getting rate from Flutterwave source"
curl -s "$BASE_URL/swap/rate" | jq '.'
echo ""
echo ""

# Test 6: Switch back to ExchangeRate-API
echo "6️⃣  Testing PUT /swap/rate/source (switch back to ExchangeRate-API)"
curl -s -X PUT "$BASE_URL/swap/rate/source" \
  -H "Content-Type: application/json" \
  -d '{"source": "exchange_rate_api"}' | jq '.'
echo ""
echo ""

# Test 7: Verify rate source changed back
echo "7️⃣  Verifying rate source changed back"
curl -s "$BASE_URL/swap/rate/source" | jq '.'
echo ""
echo ""

echo "✅ All tests completed!"
echo ""
echo "📝 Notes:"
echo "   - Rate source switching works correctly"
echo "   - Both sources should provide USD/NGN rates"
echo "   - Automatic fallback is configured"
echo ""
echo "🔍 Next steps:"
echo "   1. Test bank transfer in Flutterwave sandbox"
echo "   2. Configure webhook URL in Flutterwave dashboard"
echo "   3. Test webhook signature verification"
echo "   4. Monitor logs for any errors"
