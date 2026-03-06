#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Configuration - mint to SWAP contract
RECIPIENT="${ADAM_SWAP_ADDRESS}"
# 100,000 USDC with 6 decimals = 100,000 * 10^6 = 100,000,000,000
AMOUNT_LOW="100000000000"
AMOUNT_HIGH="0"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Minting USDC to Swap Contract ===${NC}"
echo "Recipient (Swap Contract): $RECIPIENT"
echo "Amount: 100,000 USDC (with 6 decimals)"
echo "Raw amount: $AMOUNT_LOW"
echo "USDC Token: $USDC_ADDRESS"
echo ""

# Mint USDC to swap contract
echo -e "${YELLOW}Minting USDC to swap contract...${NC}"
USDC_RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$USDC_ADDRESS" \
    --function "mint" \
    --calldata "$RECIPIENT" "$AMOUNT_LOW" "$AMOUNT_HIGH" 2>&1)

if echo "$USDC_RESULT" | grep -q "Transaction Hash"; then
    TX_HASH=$(echo "$USDC_RESULT" | grep "Transaction Hash" | awk '{print $3}')
    echo -e "${GREEN}✅ USDC minted successfully to swap contract!${NC}"
    echo "   Transaction: $TX_HASH"
    echo ""
    echo "Waiting for transaction confirmation..."
    sleep 5
    
    # Check balance
    echo -e "${YELLOW}Checking swap contract USDC balance...${NC}"
    sncast call --url "$STARKNET_RPC_URL" \
        --contract-address "$USDC_ADDRESS" \
        --function "balanceOf" \
        --calldata "$RECIPIENT"
else
    echo -e "${RED}❌ Failed to mint USDC${NC}"
    echo "$USDC_RESULT"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Minting Complete ===${NC}"
echo "Swap contract now has 100,000 USDC available for buy operations"
