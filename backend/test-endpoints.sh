#!/bin/bash

# Test Endpoints Script
# Run after server is started: bash test-endpoints.sh YOUR_SUPER_ADMIN_WALLET

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ADMIN_WALLET=$1
BASE_URL="http://localhost:3000"

if [ -z "$ADMIN_WALLET" ]; then
  echo -e "${RED}❌ Error: Admin wallet not provided${NC}"
  echo "Usage: bash test-endpoints.sh YOUR_SUPER_ADMIN_WALLET"
  exit 1
fi

echo "🧪 Testing Admin Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base URL: $BASE_URL"
echo "Admin Wallet: $ADMIN_WALLET"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
response=$(curl -s $BASE_URL)
if echo "$response" | grep -q "ok"; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed${NC}"
fi
echo ""

# Test 2: Admin Verification
echo -e "${YELLOW}Test 2: Admin Verification${NC}"
response=$(curl -s -X GET "$BASE_URL/api/admin/verify" \
  -H "X-Admin-Wallet: $ADMIN_WALLET")
if echo "$response" | grep -q "isAdmin"; then
  echo -e "${GREEN}✅ Admin verification passed${NC}"
  echo "Response: $response"
else
  echo -e "${RED}❌ Admin verification failed${NC}"
  echo "Response: $response"
fi
echo ""

# Test 3: Check Super Admin Status
echo -e "${YELLOW}Test 3: Check Super Admin Status${NC}"
response=$(curl -s -X GET "$BASE_URL/api/admin/check-super" \
  -H "X-Admin-Wallet: $ADMIN_WALLET")
if echo "$response" | grep -q "isSuperAdmin"; then
  echo -e "${GREEN}✅ Super Admin check passed${NC}"
  echo "Response: $response"
else
  echo -e "${RED}❌ Super Admin check failed${NC}"
  echo "Response: $response"
fi
echo ""

# Test 4: List All Admins
echo -e "${YELLOW}Test 4: List All Admins (Super Admin Only)${NC}"
response=$(curl -s -X GET "$BASE_URL/api/admin/admins" \
  -H "X-Admin-Wallet: $ADMIN_WALLET")
if echo "$response" | grep -q "admins"; then
  echo -e "${GREEN}✅ List admins passed${NC}"
  echo "Response: ${response:0:200}..."
else
  echo -e "${RED}❌ List admins failed${NC}"
  echo "Response: $response"
fi
echo ""

# Test 5: Non-Admin Access (Should Fail)
echo -e "${YELLOW}Test 5: Non-Admin Access (Should Fail)${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/verify" \
  -H "X-Admin-Wallet: INVALID_WALLET_12345")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "403" ]; then
  echo -e "${GREEN}✅ Access denied as expected (403)${NC}"
else
  echo -e "${RED}❌ Should have denied access${NC}"
  echo "HTTP Code: $http_code"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Endpoint testing complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "   - Test creating a new admin via POST /api/admin/admins"
echo "   - Import POSTMAN_COLLECTION.json for detailed testing"
echo "   - Test frontend integration"
