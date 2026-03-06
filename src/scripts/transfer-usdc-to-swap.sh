#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Configuration
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

echo -e "${BLUE}=== Transferring USDC to Swap Contract ===${NC}"
echo "From: $DEPLOYER_ADDRESS"
echo "To (Swap Contract): $RECIPIENT"
echo "Amount: 100,000 USDC (with 6 decimals)"
echo "Raw amount: $AMOUNT_LOW"
echo "USDC Token: $USDC_ADDRESS"
echo ""

# Check deployer balance first
echo -e "${YELLOW}Checking deployer USDC balance...${NC}"
BALANCE_RESULT=$(sncast call --url "$STARKNET_RPC_URL" \
    --contract-address "$USDC_ADDRESS" \
    --function "balanceOf" \
    --calldata "$DEPLOYER_ADDRESS" 2>&1)

echo "$BALANCE_RESULT"
echo ""

# Transfer USDC to swap contract
echo -e "${YELLOW}Transferring USDC to swap contract...${NC}"
TRANSFER_RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$USDC_ADDRESS" \
    --function "transfer" \
    --calldata "$RECIPIENT" "$AMOUNT_LOW" "$AMOUNT_HIGH" 2>&1)

if echo "$TRANSFER_RESULT" | grep -q "Transaction Hash"; then
    TX_HASH=$(echo "$TRANSFER_RESULT" | grep "Transaction Hash" | awk '{print $3}')
    echo -e "${GREEN}✅ USDC transferred successfully to swap contract!${NC}"
    echo "   Transaction: $TX_HASH"
    echo ""
    echo "Waiting for transaction confirmation..."
    sleep 5
    
    # Check swap contract balance
    echo -e "${YELLOW}Checking swap contract USDC balance...${NC}"
    sncast call --url "$STARKNET_RPC_URL" \
        --contract-address "$USDC_ADDRESS" \
        --function "balanceOf" \
        --calldata "$RECIPIENT"
else
    echo -e "${RED}❌ Failed to transfer USDC${NC}"
    echo "$TRANSFER_RESULT"
    echo ""
    echo -e "${YELLOW}Make sure the deployer account has sufficient USDC balance.${NC}"
    echo -e "${YELLOW}You may need to get USDC from a faucet first.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Transfer Complete ===${NC}"
echo "Swap contract now has USDC available for buy operations"
