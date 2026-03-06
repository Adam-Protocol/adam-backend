#!/bin/bash

# Set USDC <-> ADUSD exchange rate to 1:1
# Usage: ./set-usdc-adusd-rate.sh

echo "Setting USDC <-> ADUSD rate to 1:1..."
npx tsx src/scripts/set-usdc-adusd-rate.ts
