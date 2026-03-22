#!/bin/bash

# Transaction Verification Testing Script
# Tests the new on-chain verification POC

set -e

API_URL="${API_URL:-http://localhost:5000}"
ENDPOINT="${ENDPOINT:-/api/v1/points/swap/complete/verified}"

echo "🧪 Transaction Verification POC - Test Suite"
echo "============================================="
echo ""
echo "API URL: $API_URL"
echo "Endpoint: $ENDPOINT"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Fake Signature (Should FAIL)
echo "Test 1: Fake Signature Attack"
echo "------------------------------"
echo "Expected: ❌ 400 Bad Request (Transaction not found)"
echo ""

FAKE_SIG="FakeSignature12345678901234567890123456789012345678901234567890123456789012345678"

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet\": \"kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED\",
    \"signature\": \"$FAKE_SIG\",
    \"status\": \"confirmed\",
    \"inputMint\": \"So11111111111111111111111111111111111111112\",
    \"outputMint\": \"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\",
    \"inputAmount\": \"1000000000\",
    \"outputAmount\": \"50000000000\",
    \"inputDecimals\": 9,
    \"outputDecimals\": 6,
    \"inputAmountUSD\": 50000,
    \"outputAmountUSD\": 50000,
    \"knsBalanceAtSwap\": \"0\",
    \"slippageBps\": 50
  }")

body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$status" = "400" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Fake signature blocked (HTTP $status)"
  echo "Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Fake signature NOT blocked (HTTP $status)"
  echo "Response: $body"
fi

echo ""
echo ""

# Test 2: Real Transaction (Requires manual input)
echo "Test 2: Real Transaction Verification"
echo "--------------------------------------"
echo "⚠️  This test requires a REAL transaction signature"
echo ""
echo "To test with a real transaction:"
echo "1. Perform a swap on KindSwap frontend"
echo "2. Get the transaction signature from Phantom or Solscan"
echo "3. Run:"
echo ""
echo "   REAL_SIG=\"YourRealSignature...\" \\"
echo "   WALLET=\"YourWalletAddress...\" \\"
echo "   $0"
echo ""

if [ -n "$REAL_SIG" ] && [ -n "$WALLET" ]; then
  echo "Found environment variables - testing with real signature..."
  echo "Signature: ${REAL_SIG:0:20}..."
  echo "Wallet: ${WALLET:0:20}..."
  echo ""

  response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{
      \"wallet\": \"$WALLET\",
      \"signature\": \"$REAL_SIG\",
      \"status\": \"confirmed\",
      \"inputMint\": \"So11111111111111111111111111111111111111112\",
      \"outputMint\": \"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\",
      \"inputAmount\": \"100000000\",
      \"outputAmount\": \"5000000\",
      \"inputDecimals\": 9,
      \"outputDecimals\": 6,
      \"inputAmountUSD\": 10,
      \"outputAmountUSD\": 10,
      \"knsBalanceAtSwap\": \"0\",
      \"slippageBps\": 50
    }")

  body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
  status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Real transaction verified (HTTP $status)"
    echo "Response: $body"
  else
    echo -e "${RED}❌ FAIL${NC} - Real transaction rejected (HTTP $status)"
    echo "Response: $body"
  fi
else
  echo -e "${YELLOW}⏭️  SKIP${NC} - No real signature provided (use REAL_SIG and WALLET env vars)"
fi

echo ""
echo ""

# Test 3: Invalid Signature Format
echo "Test 3: Invalid Signature Format"
echo "---------------------------------"
echo "Expected: ❌ 400 Bad Request (Invalid signature format)"
echo ""

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED",
    "signature": "TooShort",
    "status": "confirmed",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inputAmountUSD": 100
  }')

body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$status" = "400" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Invalid format blocked (HTTP $status)"
  echo "Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Invalid format NOT blocked (HTTP $status)"
  echo "Response: $body"
fi

echo ""
echo ""

# Test 4: Missing Required Fields
echo "Test 4: Missing Required Fields"
echo "--------------------------------"
echo "Expected: ❌ 400 Bad Request (Wallet and signature required)"
echo ""

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "inputAmountUSD": 100
  }')

body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$status" = "400" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Missing fields blocked (HTTP $status)"
  echo "Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Missing fields NOT blocked (HTTP $status)"
  echo "Response: $body"
fi

echo ""
echo ""

# Summary
echo "============================================="
echo "Test Suite Complete"
echo "============================================="
echo ""
echo "Note: This POC blocks fake signatures and wallet spoofing."
echo "      Amount manipulation is NOT yet prevented (Phase 2)."
echo ""
echo "Next Steps:"
echo "1. Test with real transaction (set REAL_SIG and WALLET env vars)"
echo "2. Monitor backend logs for verification details"
echo "3. Check database for verified transactions (verifiedAt field)"
echo ""
