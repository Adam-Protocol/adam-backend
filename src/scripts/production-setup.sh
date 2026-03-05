#!/bin/bash

# Production Setup Script for Adam Protocol
# This script performs all critical production setup tasks

# Load environment variables
source .env

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "========================================="
echo "  Adam Protocol Production Setup"
echo "========================================="
echo -e "${NC}\n"

# Check if ExchangeRate API key is configured
echo -e "${YELLOW}Checking ExchangeRate API configuration...${NC}"
if [ "$EXCHANGE_RATE_API_KEY" = "your_key_here" ] || [ -z "$EXCHANGE_RATE_API_KEY" ]; then
    echo -e "${RED}❌ EXCHANGE_RATE_API_KEY not configured${NC}"
    echo -e "${YELLOW}Please update .env with your API key from https://www.exchangerate-api.com/${NC}\n"
    exit 1
else
    echo -e "${GREEN}✅ ExchangeRate API key configured${NC}\n"
fi

# Step 1: Setup all roles
echo -e "${BLUE}Step 1: Setting up contract roles...${NC}"
bash src/scripts/setup-roles.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Role setup failed${NC}"
    exit 1
fi

echo ""

# Step 2: Verify all roles
echo -e "${BLUE}Step 2: Verifying all roles...${NC}"
bash src/scripts/verify-roles-sncast.sh

echo ""

# Step 3: Test rate endpoint
echo -e "${BLUE}Step 3: Testing exchange rate endpoint...${NC}"
echo -e "${YELLOW}Make sure the backend is running (pnpm run start:dev)${NC}"
echo -e "${YELLOW}Testing: curl http://localhost:4000/swap/rate${NC}\n"

RATE_RESPONSE=$(curl -s http://localhost:4000/swap/rate 2>&1)
if echo "$RATE_RESPONSE" | grep -q "rate"; then
    echo -e "${GREEN}✅ Rate endpoint working${NC}"
    echo "Response: $RATE_RESPONSE"
else
    echo -e "${RED}❌ Rate endpoint not responding${NC}"
    echo -e "${YELLOW}Make sure backend is running: pnpm run start:dev${NC}"
fi

echo ""
echo -e "${BLUE}========================================="
echo "  Production Setup Summary"
echo "=========================================${NC}"
echo ""
echo -e "${GREEN}✅ All critical setup tasks completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify backend is running: pnpm run start:dev"
echo "2. Test the rate endpoint: curl http://localhost:4000/swap/rate"
echo "3. Review PRODUCTION_READINESS_REPORT.md"
echo ""
