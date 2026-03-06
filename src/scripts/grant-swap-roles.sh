#!/bin/bash

# Grant MINTER_ROLE and BURNER_ROLE to AdamSwap contract
# Usage: ./grant-swap-roles.sh

echo "Granting roles to AdamSwap contract..."
npx tsx src/scripts/grant-swap-roles.ts
