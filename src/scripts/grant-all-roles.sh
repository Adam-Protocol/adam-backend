#!/bin/bash

# Load environment variables from contract directory
set -a
source ../adam-contract/.env
set +a

echo "=== Granting All Required Roles ==="
echo ""

# Role hashes
MINTER_ROLE="0x4d494e5445525f524f4c45"
BURNER_ROLE="0x4255524e45525f524f4c45"
RATE_SETTER_ROLE="0x1cf91ec47860248170f85b42d74f92cb733e7fa0012c4ada3d85e11b64cb194"

# Function to grant role
grant_role() {
    local contract=$1
    local role=$2
    local account=$3
    local role_name=$4
    local contract_name=$5
    
    echo "Granting $role_name on $contract_name to $account..."
    sncast --account "$DEPLOYER_ACCOUNT" invoke \
        --url "$STARKNET_RPC_URL" \
        --contract-address "$contract" \
        --function "grant_role" \
        --calldata "$role" "$account" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "  ✅ $role_name granted"
    else
        echo "  ⚠️  $role_name may already be granted or failed"
    fi
}

# Grant MINTER_ROLE and BURNER_ROLE to AdamSwap on ADUSD
echo "--- ADUSD Token ---"
grant_role "$ADUSD_ADDRESS" "$MINTER_ROLE" "$SWAP_ADDRESS" "MINTER_ROLE" "ADUSD"
grant_role "$ADUSD_ADDRESS" "$BURNER_ROLE" "$SWAP_ADDRESS" "BURNER_ROLE" "ADUSD"

echo ""
echo "--- ADNGN Token ---"
grant_role "$ADNGN_ADDRESS" "$MINTER_ROLE" "$SWAP_ADDRESS" "MINTER_ROLE" "ADNGN"
grant_role "$ADNGN_ADDRESS" "$BURNER_ROLE" "$SWAP_ADDRESS" "BURNER_ROLE" "ADNGN"

echo ""
echo "--- AdamSwap ---"
grant_role "$SWAP_ADDRESS" "$RATE_SETTER_ROLE" "$DEPLOYER_ADDRESS" "RATE_SETTER_ROLE" "AdamSwap"

echo ""
echo "--- AdamPool Configuration ---"
echo "Setting swap_contract on AdamPool..."
sncast --account "$DEPLOYER_ACCOUNT" invoke \
    --url "$STARKNET_RPC_URL" \
    --contract-address "$POOL_ADDRESS" \
    --function "set_swap_contract" \
    --calldata "$SWAP_ADDRESS" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "  ✅ swap_contract set"
else
    echo "  ⚠️  swap_contract may already be set or failed"
fi

echo ""
echo "=== All roles granted! ==="
echo ""
echo "Run 'bash src/scripts/verify-roles.sh' to verify the configuration."
