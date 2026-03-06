#!/bin/bash

# Set USDC address on the swap contract
# Usage: ./set-usdc-address.sh

echo "Setting USDC address on swap contract..."
npx tsx src/scripts/set-usdc-address.ts
