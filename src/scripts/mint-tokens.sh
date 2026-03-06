#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Configuration
RECIPIENT="0x04073e73e3020c886d14f35ac20a7694c69768eb8f6d28d8b0d228b7b89b9327"
# 1M tokens with 18 decimals = 1,000,000 * 10^18 = 1,000,000,000,000,000,000,000,000
AMOUNT_LOW="1000000000000000000000000"
AMOUNT_HIGH="0"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Minting Tokens ===${NC}"
echo "Recipient: $RECIPIENT"
echo "Amount: 1,000,000 tokens (with 18 decimals)"
echo "Raw amount: $AMOUNT_LOW"
echo ""
echo "ADUSD Token: $ADUSD_ADDRESS"
echo "ADNGN Token: $ADNGN_ADDRESS"
echo ""

# Mint ADUSD
echo -e "${YELLOW}Minting ADUSD...${NC}"
ADUSD_RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADUSD_ADDRESS" \
    --function "mint" \
    --calldata "$RECIPIENT" "$AMOUNT_LOW" "$AMOUNT_HIGH" 2>&1)

if echo "$ADUSD_RESULT" | grep -q "Transaction Hash"; then
    TX_HASH=$(echo "$ADUSD_RESULT" | grep "Transaction Hash" | awk '{print $3}')
    echo -e "${GREEN}✅ ADUSD minted successfully!${NC}"
    echo "   Transaction: $TX_HASH"
else
    echo -e "${RED}❌ Failed to mint ADUSD${NC}"
    echo "$ADUSD_RESULT"
    exit 1
fi

echo ""

# Mint ADNGN
echo -e "${YELLOW}Minting ADNGN...${NC}"
ADNGN_RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADNGN_ADDRESS" \
    --function "mint" \
    --calldata "$RECIPIENT" "$AMOUNT_LOW" "$AMOUNT_HIGH" 2>&1)

if echo "$ADNGN_RESULT" | grep -q "Transaction Hash"; then
    TX_HASH=$(echo "$ADNGN_RESULT" | grep "Transaction Hash" | awk '{print $3}')
    echo -e "${GREEN}✅ ADNGN minted successfully!${NC}"
    echo "   Transaction: $TX_HASH"
else
    echo -e "${RED}❌ Failed to mint ADNGN${NC}"
    echo "$ADNGN_RESULT"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Minting Complete ===${NC}"
echo "Recipient $RECIPIENT now has:"
echo "  - 1,000,000 ADUSD"
echo "  - 1,000,000 ADNGN"
