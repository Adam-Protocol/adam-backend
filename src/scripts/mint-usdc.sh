#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Configuration - mint to deployer address
RECIPIENT="${DEPLOYER_ADDRESS}"
# 10,000 USDC with 6 decimals = 10,000 * 10^6 = 10,000,000,000
AMOUNT_LOW="10000000000"
AMOUNT_HIGH="0"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Minting Test USDC ===${NC}"
echo "Recipient: $RECIPIENT"
echo "Amount: 10,000 USDC (with 6 decimals)"
echo "Raw amount: $AMOUNT_LOW"
echo "USDC Token: $USDC_ADDRESS"
echo ""

# Try to mint USDC
echo -e "${YELLOW}Minting USDC...${NC}"
USDC_RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$USDC_ADDRESS" \
    --function "mint" \
    --calldata "$RECIPIENT" "$AMOUNT_LOW" "$AMOUNT_HIGH" 2>&1)

if echo "$USDC_RESULT" | grep -q "Transaction Hash"; then
    TX_HASH=$(echo "$USDC_RESULT" | grep "Transaction Hash" | awk '{print $3}')
    echo -e "${GREEN}✅ USDC minted successfully!${NC}"
    echo "   Transaction: $TX_HASH"
    echo ""
    echo "Waiting for transaction confirmation..."
    sleep 5
    
    # Check balance
    echo -e "${YELLOW}Checking balance...${NC}"
    sncast call --url "$STARKNET_RPC_URL" \
        --contract-address "$USDC_ADDRESS" \
        --function "balance_of" \
        --calldata "$RECIPIENT"
else
    echo -e "${RED}❌ Failed to mint USDC${NC}"
    echo "$USDC_RESULT"
    echo ""
    echo -e "${YELLOW}Note: If the USDC contract doesn't have a public mint function,${NC}"
    echo -e "${YELLOW}you may need to use a faucet or request tokens from the contract owner.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Minting Complete ===${NC}"
