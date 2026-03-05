#!/bin/bash

# Load environment variables
set -a
source .env
set +a

echo "=== Granting RATE_SETTER_ROLE to Backend Wallet ==="
echo "Swap Contract: $ADAM_SWAP_ADDRESS"
echo "Backend Wallet: $DEPLOYER_ADDRESS"

# Calculate RATE_SETTER_ROLE hash
RATE_SETTER_ROLE="0x1cf91ec47860248170f85b42d74f92cb733e7fa0012c4ada3d85e11b64cb194"

echo "Role Hash: $RATE_SETTER_ROLE"
echo ""

# Grant role using starkli
starkli invoke \
  --rpc "$STARKNET_RPC_URL" \
  --account "$DEPLOYER_ADDRESS" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  "$ADAM_SWAP_ADDRESS" \
  grant_role \
  "$RATE_SETTER_ROLE" \
  "$DEPLOYER_ADDRESS"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ RATE_SETTER_ROLE granted successfully!"
else
  echo ""
  echo "❌ Failed to grant RATE_SETTER_ROLE"
  exit 1
fi
