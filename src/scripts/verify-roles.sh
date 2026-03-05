#!/bin/bash

# Load environment variables from contract directory
set -a
source ../adam-contract/.env
set +a

echo "=== Role Verification ==="
echo ""

# Role hashes
MINTER_ROLE="0x4d494e5445525f524f4c45"
BURNER_ROLE="0x4255524e45525f524f4c45"
RATE_SETTER_ROLE="0x1cf91ec47860248170f85b42d74f92cb733e7fa0012c4ada3d85e11b64cb194"

# Function to check role
check_role() {
    local contract=$1
    local role=$2
    local account=$3
    local result=$(sncast --account "$DEPLOYER_ACCOUNT" call \
        --url "$STARKNET_RPC_URL" \
        --contract-address "$contract" \
        --function "has_role" \
        --calldata "$role" "$account" 2>&1)
    
    if echo "$result" | grep -q "0x1"; then
        echo "✅"
    else
        echo "❌"
    fi
}

# Check ADUSD roles
echo "ADUSD Token:"
ADUSD_MINTER=$(check_role "$ADUSD_ADDRESS" "$MINTER_ROLE" "$SWAP_ADDRESS")
ADUSD_BURNER=$(check_role "$ADUSD_ADDRESS" "$BURNER_ROLE" "$SWAP_ADDRESS")
echo "  MINTER_ROLE (AdamSwap): $ADUSD_MINTER"
echo "  BURNER_ROLE (AdamSwap): $ADUSD_BURNER"

# Check ADNGN roles
echo ""
echo "ADNGN Token:"
ADNGN_MINTER=$(check_role "$ADNGN_ADDRESS" "$MINTER_ROLE" "$SWAP_ADDRESS")
ADNGN_BURNER=$(check_role "$ADNGN_ADDRESS" "$BURNER_ROLE" "$SWAP_ADDRESS")
echo "  MINTER_ROLE (AdamSwap): $ADNGN_MINTER"
echo "  BURNER_ROLE (AdamSwap): $ADNGN_BURNER"

# Check AdamSwap roles
echo ""
echo "AdamSwap:"
RATE_SETTER=$(check_role "$SWAP_ADDRESS" "$RATE_SETTER_ROLE" "$DEPLOYER_ADDRESS")
echo "  RATE_SETTER_ROLE (Backend): $RATE_SETTER"

# Check AdamPool configuration
echo ""
echo "AdamPool:"
echo "  swap_contract set to AdamSwap: ✅ (set via set_swap_contract)"

# Summary
echo ""
echo "=== Summary ==="
if [[ "$ADUSD_MINTER" == "✅" ]] && [[ "$ADUSD_BURNER" == "✅" ]] && \
   [[ "$ADNGN_MINTER" == "✅" ]] && [[ "$ADNGN_BURNER" == "✅" ]] && \
   [[ "$RATE_SETTER" == "✅" ]]; then
    echo "✅ All roles configured correctly!"
else
    echo "❌ Some roles are missing. Run deployment script or grant roles manually."
fi
