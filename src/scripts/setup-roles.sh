#!/bin/bash

# Setup all required roles for Adam Protocol
# This script grants necessary roles to contracts after deployment

# Load environment variables
source .env

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Adam Protocol Role Setup ===${NC}\n"

# Role hashes
MINTER_ROLE="0x4d494e5445525f524f4c45"
BURNER_ROLE="0x4255524e45525f524f4c45"

# Step 1: Grant MINTER_ROLE to DEPLOYER_ADDRESS on ADUSD
echo -e "${YELLOW}Step 1: Granting MINTER_ROLE to $DEPLOYER_ADDRESS on ADUSD...${NC}"
RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADUSD_ADDRESS" \
    --function grant_role \
    --calldata "$MINTER_ROLE" "$DEPLOYER_ADDRESS" 2>&1)

if echo "$RESULT" | grep -q "Transaction Hash:"; then
    TX_HASH=$(echo "$RESULT" | grep "Transaction Hash:" | awk '{print $3}')
    echo -e "${GREEN}✅ Transaction submitted: $TX_HASH${NC}\n"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "$RESULT"
fi

# Step 2: Grant BURNER_ROLE to DEPLOYER_ADDRESS on ADUSD
echo -e "${YELLOW}Step 2: Granting BURNER_ROLE to $DEPLOYER_ADDRESS on ADUSD...${NC}"
RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADUSD_ADDRESS" \
    --function grant_role \
    --calldata "$BURNER_ROLE" "$DEPLOYER_ADDRESS" 2>&1)

if echo "$RESULT" | grep -q "Transaction Hash:"; then
    TX_HASH=$(echo "$RESULT" | grep "Transaction Hash:" | awk '{print $3}')
    echo -e "${GREEN}✅ Transaction submitted: $TX_HASH${NC}\n"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "$RESULT"
fi

# Step 3: Grant MINTER_ROLE to DEPLOYER_ADDRESS on ADNGN
echo -e "${YELLOW}Step 3: Granting MINTER_ROLE to $DEPLOYER_ADDRESS on ADNGN...${NC}"
RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADNGN_ADDRESS" \
    --function grant_role \
    --calldata "$MINTER_ROLE" "$DEPLOYER_ADDRESS" 2>&1)

if echo "$RESULT" | grep -q "Transaction Hash:"; then
    TX_HASH=$(echo "$RESULT" | grep "Transaction Hash:" | awk '{print $3}')
    echo -e "${GREEN}✅ Transaction submitted: $TX_HASH${NC}\n"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "$RESULT"
fi

# Step 4: Grant BURNER_ROLE to DEPLOYER_ADDRESS on ADNGN
echo -e "${YELLOW}Step 4: Granting BURNER_ROLE to $DEPLOYER_ADDRESS on ADNGN...${NC}"
RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADNGN_ADDRESS" \
    --function grant_role \
    --calldata "$BURNER_ROLE" "$DEPLOYER_ADDRESS" 2>&1)

if echo "$RESULT" | grep -q "Transaction Hash:"; then
    TX_HASH=$(echo "$RESULT" | grep "Transaction Hash:" | awk '{print $3}')
    echo -e "${GREEN}✅ Transaction submitted: $TX_HASH${NC}\n"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "$RESULT"
fi

# Step 5: Set swap_contract on AdamPool
echo -e "${YELLOW}Step 5: Setting swap_contract on AdamPool...${NC}"
RESULT=$(sncast --account caxtonstone1 invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$ADAM_POOL_ADDRESS" \
    --function set_swap_contract \
    --calldata "$ADAM_SWAP_ADDRESS" 2>&1)

if echo "$RESULT" | grep -q "Transaction Hash:"; then
    TX_HASH=$(echo "$RESULT" | grep "Transaction Hash:" | awk '{print $3}')
    echo -e "${GREEN}✅ Transaction submitted: $TX_HASH${NC}\n"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "$RESULT"
fi

echo -e "${BLUE}=== Waiting for transactions to confirm... ===${NC}"
echo -e "${YELLOW}This may take 30-60 seconds...${NC}\n"
sleep 30

echo -e "${GREEN}✅ Role setup complete!${NC}"
echo -e "${BLUE}Run 'bash src/scripts/verify-roles-sncast.sh' to verify all roles.${NC}"
