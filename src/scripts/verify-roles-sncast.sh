#!/bin/bash

# Load environment variables
source .env

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Role Verification ===${NC}\n"

# Role hashes
MINTER_ROLE="0x4d494e5445525f524f4c45"
BURNER_ROLE="0x4255524e45525f524f4c45"
RATE_SETTER_ROLE="0x1cf91ec47860248170f85b42d74f92cb733e7fa0012c4ada3d85e11b64cb194"

# Check ADUSD roles
echo "ADUSD Token:"
ADUSD_MINTER=$(sncast --account caxtonstone1 call --url "$STARKNET_RPC_URL" --contract-address "$ADUSD_ADDRESS" --function has_role --calldata "$MINTER_ROLE" "$DEPLOYER_ADDRESS" 2>&1 | grep "Response:" | awk '{print $2}')
ADUSD_BURNER=$(sncast --account caxtonstone1 call --url "$STARKNET_RPC_URL" --contract-address "$ADUSD_ADDRESS" --function has_role --calldata "$BURNER_ROLE" "$DEPLOYER_ADDRESS" 2>&1 | grep "Response:" | awk '{print $2}')

if [ "$ADUSD_MINTER" = "true" ]; then
    echo -e "  MINTER_ROLE (Deployer): ${GREEN}✅${NC}"
else
    echo -e "  MINTER_ROLE (Deployer): ${RED}❌${NC}"
fi

if [ "$ADUSD_BURNER" = "true" ]; then
    echo -e "  BURNER_ROLE (Deployer): ${GREEN}✅${NC}"
else
    echo -e "  BURNER_ROLE (Deployer): ${RED}❌${NC}"
fi

# Check ADNGN roles
echo -e "\nADNGN Token:"
ADNGN_MINTER=$(sncast --account caxtonstone1 call --url "$STARKNET_RPC_URL" --contract-address "$ADNGN_ADDRESS" --function has_role --calldata "$MINTER_ROLE" "0x4c73687f23639fdfd8d7d71ea7fccd62866351b0eff5efea14148c7b6ee5b27" 2>&1 | grep "Response:" | awk '{print $2}')
ADNGN_BURNER=$(sncast --account caxtonstone1 call --url "$STARKNET_RPC_URL" --contract-address "$ADNGN_ADDRESS" --function has_role --calldata "$BURNER_ROLE" "0x4c73687f23639fdfd8d7d71ea7fccd62866351b0eff5efea14148c7b6ee5b27" 2>&1 | grep "Response:" | awk '{print $2}')

if [ "$ADNGN_MINTER" = "true" ]; then
    echo -e "  MINTER_ROLE (AdamSwap): ${GREEN}✅${NC}"
else
    echo -e "  MINTER_ROLE (AdamSwap): ${RED}❌${NC}"
fi

if [ "$ADNGN_BURNER" = "true" ]; then
    echo -e "  BURNER_ROLE (AdamSwap): ${GREEN}✅${NC}"
else
    echo -e "  BURNER_ROLE (AdamSwap): ${RED}❌${NC}"
fi

# Check AdamSwap roles
echo -e "\nAdamSwap:"
RATE_SETTER=$(sncast --account caxtonstone1 call --url "$STARKNET_RPC_URL" --contract-address "$ADAM_SWAP_ADDRESS" --function has_role --calldata "$RATE_SETTER_ROLE" "$DEPLOYER_ADDRESS" 2>&1 | grep "Response:" | awk '{print $2}')

if [ "$RATE_SETTER" = "true" ]; then
    echo -e "  RATE_SETTER_ROLE (Backend): ${GREEN}✅${NC}"
else
    echo -e "  RATE_SETTER_ROLE (Backend): ${RED}❌${NC}"
fi

# Check AdamPool configuration
echo -e "\nAdamPool:"
POOL_SWAP=$(sncast --account caxtonstone1 call --url "$STARKNET_RPC_URL" --contract-address "$ADAM_POOL_ADDRESS" --function swap_contract 2>&1 | grep "Response:" | awk '{print $2}')

if [ "$POOL_SWAP" = "$ADAM_SWAP_ADDRESS" ]; then
    echo -e "  swap_contract set to AdamSwap: ${GREEN}✅${NC}"
else
    echo -e "  swap_contract set to AdamSwap: ${RED}❌${NC}"
    echo "    Expected: $ADAM_SWAP_ADDRESS"
    echo "    Actual: $POOL_SWAP"
fi

# Summary
echo -e "\n${BLUE}=== Summary ===${NC}"
if [ "$ADUSD_MINTER" = "true" ] && [ "$ADUSD_BURNER" = "true" ] && \
   [ "$ADNGN_MINTER" = "true" ] && [ "$ADNGN_BURNER" = "true" ] && \
   [ "$RATE_SETTER" = "true" ] && [ "$POOL_SWAP" = "$ADAM_SWAP_ADDRESS" ]; then
    echo -e "${GREEN}✅ All roles configured correctly!${NC}"
else
    echo -e "${RED}❌ Some roles are missing. Run deployment script or grant roles manually.${NC}"
fi
