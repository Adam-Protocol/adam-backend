#!/bin/bash

# Load environment variables
set -a
source .env
set +a

echo "=== Checking Token Decimals ==="
echo ""

# Check ADUSD decimals
echo "ADUSD decimals:"
sncast --account caxtonstone1 call \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADUSD_ADDRESS" \
    --function "decimals"

echo ""

# Check ADNGN decimals
echo "ADNGN decimals:"
sncast --account caxtonstone1 call \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADNGN_ADDRESS" \
    --function "decimals"
