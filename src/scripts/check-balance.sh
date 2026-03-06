#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Configuration
WALLET="0x04073e73e3020c886d14f35ac20a7694c69768eb8f6d28d8b0d228b7b89b9327"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Checking Token Balances ===${NC}"
echo "Wallet: $WALLET"
echo ""

# Check ADUSD balance
echo "ADUSD Balance:"
sncast --account caxtonstone1 call \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADUSD_ADDRESS" \
    --function "balance_of" \
    --calldata "$WALLET"

echo ""

# Check ADNGN balance
echo "ADNGN Balance:"
sncast --account caxtonstone1 call \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADNGN_ADDRESS" \
    --function "balance_of" \
    --calldata "$WALLET"
