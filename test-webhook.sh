#!/bin/bash

# Test script for Flutterwave webhook handling
# This simulates a Flutterwave webhook call

BASE_URL="http://localhost:4000"
WEBHOOK_SECRET="${FLUTTERWAVE_WEBHOOK_SECRET_HASH:-Manofgod123.}"

# Sample webhook payload for transfer completed
PAYLOAD='{
  "event": "transfer.completed",
  "data": {
    "id": 12345,
    "account_number": "0123456789",
    "bank_code": "044",
    "full_name": "Test User",
    "created_at": "2026-03-05T10:00:00.000Z",
    "currency": "NGN",
    "debit_currency": "NGN",
    "amount": 10000,
    "fee": 50,
    "status": "SUCCESSFUL",
    "reference": "ADAM-test-transaction-id-1234567890",
    "meta": null,
    "narration": "Adam Protocol offramp - ADNGN",
    "complete_message": "Transfer completed successfully",
    "requires_approval": 0,
    "is_approved": 1,
    "bank_name": "Access Bank"
  }
}'

# Calculate HMAC signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

echo "🧪 Testing Flutterwave Webhook"
echo "=============================="
echo ""
echo "📦 Payload:"
echo "$PAYLOAD" | jq '.'
echo ""
echo "🔐 Signature: $SIGNATURE"
echo ""
echo "📡 Sending webhook to $BASE_URL/offramp/webhook"
echo ""

# Send webhook request
RESPONSE=$(curl -s -X POST "$BASE_URL/offramp/webhook" \
  -H "Content-Type: application/json" \
  -H "verif-hash: $SIGNATURE" \
  -d "$PAYLOAD")

echo "📥 Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Test with invalid signature
echo "🔒 Testing with invalid signature (should fail)"
INVALID_SIGNATURE="invalid_signature_12345"
RESPONSE=$(curl -s -X POST "$BASE_URL/offramp/webhook" \
  -H "Content-Type: application/json" \
  -H "verif-hash: $INVALID_SIGNATURE" \
  -d "$PAYLOAD")

echo "📥 Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Test transfer failed event
FAILED_PAYLOAD='{
  "event": "transfer.failed",
  "data": {
    "id": 12346,
    "reference": "ADAM-test-transaction-id-1234567891",
    "status": "FAILED",
    "complete_message": "Insufficient balance",
    "currency": "NGN",
    "amount": 10000
  }
}'

FAILED_SIGNATURE=$(echo -n "$FAILED_PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

echo "❌ Testing transfer.failed event"
echo "📦 Payload:"
echo "$FAILED_PAYLOAD" | jq '.'
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/offramp/webhook" \
  -H "Content-Type: application/json" \
  -H "verif-hash: $FAILED_SIGNATURE" \
  -d "$FAILED_PAYLOAD")

echo "📥 Response:"
echo "$RESPONSE" | jq '.'
echo ""

echo "✅ Webhook tests completed!"
echo ""
echo "📝 Notes:"
echo "   - Valid signature should return success"
echo "   - Invalid signature should return error"
echo "   - Both completed and failed events tested"
echo ""
echo "🔍 Check server logs for detailed processing information"
