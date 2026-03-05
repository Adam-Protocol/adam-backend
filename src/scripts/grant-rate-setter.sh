#!/bin/bash

# Load environment variables from contract directory
set -a
source ../adam-contract/.env
set +a

echo "=== Granting RATE_SETTER_ROLE to Backend Wallet ==="
echo "Swap Contract: $SWAP_ADDRESS"
echo "Backend Wallet: $DEPLOYER_ADDRESS"
echo "Account: $DEPLOYER_ACCOUNT"

# Calculate RATE_SETTER_ROLE hash
RATE_SETTER_ROLE="0x1cf91ec47860248170f85b42d74f92cb733e7fa0012c4ada3d85e11b64cb194"

echo "Role Hash: $RATE_SETTER_ROLE"
echo ""

# Grant role using sncast with the configured account
sncast \
  --account "$DEPLOYER_ACCOUNT" \
  invoke \
  --url "$STARKNET_RPC_URL" \
  --contract-address "$SWAP_ADDRESS" \
  --function "grant_role" \
  --calldata "$RATE_SETTER_ROLE" "$DEPLOYER_ADDRESS"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ RATE_SETTER_ROLE granted successfully!"
else
  echo ""
  echo "❌ Failed to grant RATE_SETTER_ROLE"
  exit 1
fi
