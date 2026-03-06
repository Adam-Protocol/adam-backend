#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== USDC Balance Check ===${NC}"
echo ""
echo "USDC Contract: $USDC_ADDRESS"
echo "Deployer: $DEPLOYER_ADDRESS"
echo "Swap Contract: $ADAM_SWAP_ADDRESS"
echo ""

# Check deployer balance
echo -e "${YELLOW}Checking deployer USDC balance...${NC}"
DEPLOYER_BALANCE=$(sncast call --url "$STARKNET_RPC_URL" \
    --contract-address "$USDC_ADDRESS" \
    --function "balanceOf" \
    --calldata "$DEPLOYER_ADDRESS" 2>&1)

if echo "$DEPLOYER_BALANCE" | grep -q "Success"; then
    BALANCE_VALUE=$(echo "$DEPLOYER_BALANCE" | grep "Response:" | head -1 | awk '{print $2}')
    echo -e "${GREEN}Deployer Balance: $BALANCE_VALUE${NC}"
else
    echo -e "${RED}Failed to check deployer balance${NC}"
    echo "$DEPLOYER_BALANCE"
fi

echo ""

# Check swap contract balance
echo -e "${YELLOW}Checking swap contract USDC balance...${NC}"
SWAP_BALANCE=$(sncast call --url "$STARKNET_RPC_URL" \
    --contract-address "$USDC_ADDRESS" \
    --function "balanceOf" \
    --calldata "$ADAM_SWAP_ADDRESS" 2>&1)

if echo "$SWAP_BALANCE" | grep -q "Success"; then
    BALANCE_VALUE=$(echo "$SWAP_BALANCE" | grep "Response:" | head -1 | awk '{print $2}')
    echo -e "${GREEN}Swap Contract Balance: $BALANCE_VALUE${NC}"
    
    # Check if balance is zero
    if echo "$BALANCE_VALUE" | grep -q "0_u256"; then
        echo ""
        echo -e "${RED}⚠️  WARNING: Swap contract has ZERO USDC balance!${NC}"
        echo -e "${YELLOW}Buy transactions will fail until USDC is added.${NC}"
        echo ""
        echo -e "${BLUE}To fix this issue:${NC}"
        echo "1. Get USDC from a faucet for deployer address:"
        echo "   $DEPLOYER_ADDRESS"
        echo ""
        echo "2. Transfer USDC to swap contract:"
        echo "   ./src/scripts/transfer-usdc-to-swap.sh"
        echo ""
        echo "3. Recommended amount: 100,000 USDC (100000000000 with 6 decimals)"
        echo ""
        echo "See USDC_SOLUTION.md for detailed instructions."
    else
        echo -e "${GREEN}✅ Swap contract has sufficient USDC for operations${NC}"
    fi
else
    echo -e "${RED}Failed to check swap contract balance${NC}"
    echo "$SWAP_BALANCE"
fi

echo ""
echo -e "${BLUE}=== Balance Check Complete ===${NC}"
