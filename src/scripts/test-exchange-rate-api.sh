#!/bin/bash

# Load environment variables
set -a
source .env
set +a

echo "=== Testing ExchangeRate-API Configuration ==="
echo ""

# Check if API key is configured
if [ "$EXCHANGE_RATE_API_KEY" = "your_key_here" ] || [ -z "$EXCHANGE_RATE_API_KEY" ]; then
    echo "❌ EXCHANGE_RATE_API_KEY is not configured!"
    echo ""
    echo "Please update adam-backend/.env with your actual API key:"
    echo "  EXCHANGE_RATE_API_KEY=your_actual_key_here"
    echo ""
    echo "Get a free API key from: https://www.exchangerate-api.com/"
    exit 1
fi

echo "API Key: ${EXCHANGE_RATE_API_KEY:0:10}... (hidden)"
echo "API URL: $EXCHANGE_RATE_API_URL"
echo ""

# Test the API
echo "Testing API endpoint..."
API_URL="${EXCHANGE_RATE_API_URL}/${EXCHANGE_RATE_API_KEY}/latest/USD"

RESPONSE=$(curl -s "$API_URL")

# Check if request was successful
if echo "$RESPONSE" | grep -q '"result":"success"'; then
    echo "✅ API connection successful!"
    echo ""
    
    # Extract USD/NGN rate
    USD_NGN=$(echo "$RESPONSE" | grep -o '"NGN":[0-9.]*' | cut -d':' -f2)
    
    if [ -n "$USD_NGN" ]; then
        echo "Current Exchange Rate:"
        echo "  1 USD = $USD_NGN NGN"
        echo ""
        
        # Extract timestamp
        TIME_UPDATED=$(echo "$RESPONSE" | grep -o '"time_last_update_unix":[0-9]*' | cut -d':' -f2)
        if [ -n "$TIME_UPDATED" ]; then
            READABLE_TIME=$(date -d "@$TIME_UPDATED" 2>/dev/null || date -r "$TIME_UPDATED" 2>/dev/null)
            echo "Last Updated: $READABLE_TIME"
        fi
        
        echo ""
        echo "✅ ExchangeRate-API is properly configured!"
        echo ""
        echo "The backend will:"
        echo "  - Fetch rates every 5 minutes"
        echo "  - Update on-chain rate via RATE_SETTER_ROLE"
        echo "  - Cache rates for API responses"
        
    else
        echo "⚠️  API responded but NGN rate not found"
        echo ""
        echo "Response preview:"
        echo "$RESPONSE" | head -5
    fi
    
elif echo "$RESPONSE" | grep -q '"result":"error"'; then
    ERROR_TYPE=$(echo "$RESPONSE" | grep -o '"error-type":"[^"]*"' | cut -d'"' -f4)
    echo "❌ API Error: $ERROR_TYPE"
    echo ""
    
    case "$ERROR_TYPE" in
        "invalid-key")
            echo "The API key is invalid. Please check:"
            echo "  1. Copy the correct key from https://app.exchangerate-api.com/"
            echo "  2. Update EXCHANGE_RATE_API_KEY in adam-backend/.env"
            ;;
        "quota-reached")
            echo "API quota reached. Free tier limits:"
            echo "  - 1,500 requests per month"
            echo "  - Consider upgrading or using a different key"
            ;;
        *)
            echo "Error details:"
            echo "$RESPONSE"
            ;;
    esac
    exit 1
    
else
    echo "❌ Unexpected response from API"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | head -10
    exit 1
fi
