# KindSwap Points System
## Complete API & Database Schema Documentation

**Version:** 1.0.0
**Date:** January 13, 2026
**Environment:** Production Ready
**Database:** PostgreSQL 16
**Framework:** NestJS 11

---

# TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Database Schema](#database-schema)
3. [API Documentation](#api-documentation)
4. [Data Models](#data-models)
5. [Integration Guide](#integration-guide)
6. [Error Handling](#error-handling)

---

# EXECUTIVE SUMMARY

The KindSwap Points System is a comprehensive backend solution for tracking user points, managing fee discounts based on KNS holdings, and maintaining a leaderboard. The system is built on:

- **3 Database Tables** with strategic indexing for optimal performance
- **4 Core API Endpoints** for swap logging, points retrieval, and leaderboard ranking
- **Points Earning Mechanisms:** Swap Points, Community Points, KNS Holding Points
- **Fee Discount System:** 5 tiers (0-20% discount based on KNS balance)
- **Daily/Weekly Caps** to prevent gaming and maintain system balance

---

# DATABASE SCHEMA

## 1. Overview & Architecture

### Design Goals
- Track wallet-based user data
- Manage three independent point sources
- Maintain comprehensive audit trail of all swaps
- Optimize for leaderboard queries
- Support analytics and compliance

### Database Connection Details

```
Host: localhost
Port: 5432
Database: kindsoul_db
Username: kindsoul_user
Password: kindsoul_secure_password_change_me
```

### Tables Summary

| Table | Records | Size | Purpose |
|-------|---------|------|---------|
| `users` | ~10,000 | 2.5 MB | Core wallet registry |
| `user_points` | ~10,000 | 5 MB | Points tracking & leaderboard |
| `swap_transactions` | ~1,000,000 | 500 MB | Audit log & analytics |

---

## 2. Table: USERS

**Purpose:** Core wallet and user data storage
**Primary Key:** `id` (UUID)
**Unique Key:** `wallet`

### Column Definitions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | Unique identifier |
| `wallet` | VARCHAR(88) | NO | - | Solana wallet address (base58) |
| `knsBalance` | BIGINT | NO | 0 | KNS token balance (lamports) |
| `lastBalanceCheckAt` | TIMESTAMP | YES | - | Last balance verification time |
| `optedOut` | BOOLEAN | NO | false | Participation flag |
| `notes` | TEXT | YES | - | Admin notes |
| `createdAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last update timestamp |

### Indexes

```sql
CREATE UNIQUE INDEX IDX_USERS_WALLET ON users (wallet);
```

### Constraints

```sql
PRIMARY KEY (id)
UNIQUE (wallet)
FOREIGN KEY (wallet) <- user_points.wallet CASCADE DELETE
FOREIGN KEY (wallet) <- swap_transactions.wallet CASCADE DELETE
```

### Sample Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "knsBalance": 1000000000,
  "lastBalanceCheckAt": "2026-01-13T10:30:00Z",
  "optedOut": false,
  "notes": "VIP early adopter",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-13T10:30:00Z"
}
```

---

## 3. Table: USER_POINTS

**Purpose:** Points tracking and leaderboard ranking
**Primary Key:** `id` (UUID)
**Foreign Key:** `wallet` → `users.wallet` (CASCADE DELETE)

### Column Definitions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | gen_random_uuid() | Unique identifier |
| `wallet` | VARCHAR(88) | NO | - | Denormalized wallet for queries |
| `swapPoints` | INTEGER | NO | 0 | Swap-based points earned |
| `communityPoints` | INTEGER | NO | 0 | Manually awarded community points |
| `knsPoints` | INTEGER | NO | 0 | Daily KNS holding points |
| `totalPoints` | INTEGER | NO | 0 | **DENORMALIZED** sum for ranking |
| `swapPointsToday` | INTEGER | NO | 0 | Today's swap points (tracks daily cap) |
| `lastSwapDayReset` | DATE | YES | - | Last daily counter reset |
| `communityPointsThisWeek` | INTEGER | NO | 0 | Week's community points (tracks cap) |
| `lastWeekReset` | DATE | YES | - | Last weekly counter reset |
| `currentRank` | INTEGER | YES | - | Current leaderboard rank (1-100) |
| `previousRank` | INTEGER | YES | - | Previous period rank |
| `totalSwapVolumeUSD` | DECIMAL(20,2) | NO | 0.00 | Cumulative swap volume |
| `totalSwapsCount` | INTEGER | NO | 0 | Total number of swaps |
| `averageSwapSize` | DECIMAL(18,2) | NO | 0.00 | Average swap size USD |
| `lastPointsUpdate` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last points modification |
| `lastTopRankTime` | TIMESTAMP | YES | - | When reached rank #1 |
| `version` | INTEGER | NO | 0 | Optimistic locking version |
| `createdAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last update timestamp |

### Indexes

```sql
CREATE INDEX IDX_USER_POINTS_TOTAL_WALLET ON user_points (totalPoints DESC, wallet);
CREATE INDEX IDX_USER_POINTS_SWAP_POINTS ON user_points (swapPoints DESC);
CREATE INDEX IDX_USER_POINTS_COMMUNITY_POINTS ON user_points (communityPoints DESC);
CREATE INDEX IDX_USER_POINTS_KNS_POINTS ON user_points (knsPoints DESC);
CREATE INDEX IDX_USER_POINTS_WALLET_UPDATED ON user_points (wallet, updatedAt DESC);
```

### Points Calculation Logic

**Swap Points Formula:**
```
IF inputAmountUSD >= 5 USD:
  points_earned = FLOOR(inputAmountUSD)
ELSE:
  points_earned = 0
```

**Daily Cap:** 10,000 swap points/day (resets at UTC midnight)

**Community Points:** Admin-awarded, 2,000 cap/week

**KNS Holding Points:** Based on 5 brackets
```
0 - 1k KNS:       50 points/day
1k - 10k KNS:     100 points/day
10k - 100k KNS:   250 points/day
100k - 1M KNS:    400 points/day
1M+ KNS:          500 points/day
```

**Total Points:** swapPoints + communityPoints + knsPoints

### Sample Record

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "swapPoints": 25500,
  "communityPoints": 1200,
  "knsPoints": 15000,
  "totalPoints": 41700,
  "swapPointsToday": 450,
  "lastSwapDayReset": "2026-01-13",
  "communityPointsThisWeek": 600,
  "lastWeekReset": "2026-01-13",
  "currentRank": 3,
  "previousRank": 5,
  "totalSwapVolumeUSD": "128500.50",
  "totalSwapsCount": 245,
  "averageSwapSize": "524.69",
  "lastPointsUpdate": "2026-01-13T14:22:30Z",
  "lastTopRankTime": null,
  "version": 47,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-13T14:22:30Z"
}
```

---

## 4. Table: SWAP_TRANSACTIONS

**Purpose:** Complete audit log for all swaps
**Primary Key:** `signature` (VARCHAR 88)
**Foreign Key:** `wallet` → `users.wallet` (CASCADE DELETE)

### Column Definitions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `signature` | VARCHAR(88) | NO | - | Unique Solana transaction signature (primary key) |
| `wallet` | VARCHAR(88) | NO | - | Wallet that executed swap |
| `inputMint` | VARCHAR(44) | NO | - | Input token mint address |
| `outputMint` | VARCHAR(44) | NO | - | Output token mint address |
| `inputAmount` | VARCHAR(80) | NO | - | Input amount (stored as string for precision) |
| `outputAmount` | VARCHAR(80) | NO | - | Output amount (stored as string for precision) |
| `inputDecimals` | INTEGER | NO | - | Input token decimals |
| `outputDecimals` | INTEGER | NO | - | Output token decimals |
| `inputAmountUSD` | DECIMAL(20,2) | NO | - | Input amount in USD |
| `outputAmountUSD` | DECIMAL(20,2) | NO | - | Output amount in USD |
| `feeTier` | VARCHAR(20) | NO | - | Fee tier applied: "No Tier", "Tier 1", "Tier 2", "Tier 3", "Tier 4" |
| `discountPercent` | INTEGER | NO | - | KNS discount: 0, 5, 10, 15, or 20 |
| `effectiveFeeBps` | DECIMAL(5,1) | NO | - | Effective fee: 10.0, 9.5, 9.0, 8.5, or 8.0 bps |
| `feeAmountUSD` | DECIMAL(20,2) | NO | - | Total fee collected USD |
| `charityAmountUSD` | DECIMAL(20,2) | NO | - | Charity portion (0.05% of swap) |
| `kindswapFeeUSD` | DECIMAL(20,2) | NO | - | KindSwap platform fee portion |
| `routeData` | JSONB | YES | - | Jupiter route information |
| `status` | VARCHAR(20) | NO | 'pending' | Transaction status |
| `blockHeight` | BIGINT | YES | - | Block height when confirmed |
| `pointsAwardedAmount` | INTEGER | NO | - | Points awarded to user |
| `pointsAwarded` | BOOLEAN | NO | true | Whether points were awarded |
| `slippageBps` | INTEGER | NO | - | Slippage tolerance (basis points) |
| `actualPriceImpactPct` | DECIMAL(5,2) | YES | - | Actual price impact % |
| `knsBalanceAtSwap` | BIGINT | NO | - | User's KNS balance at swap time |
| `userAgent` | VARCHAR(255) | YES | - | Client user agent |
| `ipAddress` | VARCHAR(45) | YES | - | Client IP address |
| `errorMessage` | TEXT | YES | - | Error details if failed |
| `verifiedAt` | TIMESTAMP | YES | - | Off-chain verification timestamp |
| `notes` | TEXT | YES | - | Admin notes |
| `executedAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When executed on blockchain |
| `createdAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation timestamp |
| `updatedAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last update timestamp |

### Indexes

```sql
CREATE INDEX IDX_SWAP_TX_WALLET_EXECUTED ON swap_transactions (wallet, executedAt DESC);
CREATE INDEX IDX_SWAP_TX_STATUS_EXECUTED ON swap_transactions (status, executedAt DESC);
CREATE INDEX IDX_SWAP_TX_POINTS_AWARDED ON swap_transactions (pointsAwardedAmount DESC);
CREATE INDEX IDX_SWAP_TX_CREATED ON swap_transactions (createdAt DESC);
```

### Constraints

```sql
PRIMARY KEY (signature)
FOREIGN KEY (wallet) REFERENCES users (wallet) ON DELETE CASCADE
CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled'))
```

### Sample Record

```json
{
  "signature": "5sPEHp7...... (88 chars)",
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "inputMint": "EPjFWaLbwgqPCCVX5qQKsYzbjSH3jjhd6ypeabHQp25d",
  "outputMint": "So11111111111111111111111111111111111111112",
  "inputAmount": "1000000000",
  "outputAmount": "47500000",
  "inputDecimals": 6,
  "outputDecimals": 9,
  "inputAmountUSD": "50.00",
  "outputAmountUSD": "49.50",
  "feeTier": "Tier 2",
  "discountPercent": 10,
  "effectiveFeeBps": "9.0",
  "feeAmountUSD": "0.45",
  "charityAmountUSD": "0.025",
  "kindswapFeeUSD": "0.425",
  "routeData": {
    "marketInfos": [],
    "minOutAmount": "47125000"
  },
  "status": "confirmed",
  "blockHeight": 299000000,
  "pointsAwardedAmount": 50,
  "pointsAwarded": true,
  "slippageBps": 50,
  "actualPriceImpactPct": "1.00",
  "knsBalanceAtSwap": 50000000000,
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "203.0.113.42",
  "errorMessage": null,
  "verifiedAt": "2026-01-13T14:22:35Z",
  "notes": null,
  "executedAt": "2026-01-13T14:22:30Z",
  "createdAt": "2026-01-13T14:22:30Z",
  "updatedAt": "2026-01-13T14:22:35Z"
}
```

---

## 5. Entity Relationship Diagram

```
┌──────────────────────────────────┐
│           USERS                  │
├──────────────────────────────────┤
│ PK: id (UUID)                    │
│ UQ: wallet (VARCHAR 88)          │
│ • knsBalance (BIGINT)            │
│ • optedOut (BOOLEAN)             │
│ • notes (TEXT)                   │
└──────┬──────────────────┬────────┘
       │ CASCADE DELETE   │ CASCADE DELETE
       │                 │
       ▼                 ▼
┌──────────────────┐ ┌──────────────────────┐
│  USER_POINTS     │ │ SWAP_TRANSACTIONS    │
│   (1:1)          │ │    (1:M)             │
├──────────────────┤ ├──────────────────────┤
│ PK: id           │ │ PK: signature        │
│ FK: wallet       │ │ FK: wallet           │
│ • totalPoints ✱  │ │ • status             │
│ • swapPoints     │ │ • feeTier            │
│ • currentRank    │ │ • inputAmountUSD     │
└──────────────────┘ └──────────────────────┘

✱ DENORMALIZED for leaderboard performance
```

---

# API DOCUMENTATION

## 1. Base Configuration

**Base URL:** `http://localhost:3000/api`

**Authentication:** None (Phase 1) - Backend validates via wallet signature in future phases

**Request Format:** JSON

**Response Format:** JSON

---

## 2. Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/swap/complete` | Log completed swap and award points |
| GET | `/points/:wallet` | Get user's points breakdown |
| GET | `/leaderboard` | Get top 100 leaderboard |
| POST | `/community/award` | Award community points (admin) |
| GET | `/health` | Health check |

---

## 3. Endpoint: Log Swap Completion

### Request

**Method:** `POST`
**Endpoint:** `/api/swap/complete`
**Content-Type:** `application/json`

### Request Body

```json
{
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "signature": "5sPEHp7...(88 chars)",
  "inputAmountUSD": 50.00,
  "outputAmountUSD": 49.50,
  "inputMint": "EPjFWaLbwgqPCCVX5qQKsYzbjSH3jjhd6ypeabHQp25d",
  "outputMint": "So11111111111111111111111111111111111111112",
  "inputAmount": "1000000000",
  "outputAmount": "47500000",
  "inputDecimals": 6,
  "outputDecimals": 9,
  "feeTier": "Tier 2",
  "discountPercent": 10,
  "effectiveFeeBps": 9.0,
  "feeAmountUSD": 0.45,
  "charityAmountUSD": 0.025,
  "kindswapFeeUSD": 0.425,
  "slippageBps": 50,
  "knsBalanceAtSwap": "50000000000",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "ipAddress": "203.0.113.42"
}
```

### Request Field Descriptions

| Field | Type | Required | Format | Description |
|-------|------|----------|--------|-------------|
| `wallet` | string | YES | Solana base58 | Wallet executing swap |
| `signature` | string | YES | 88 chars | Solana transaction signature |
| `inputAmountUSD` | number | YES | > 0 | Input amount in USD (must be >= $5) |
| `outputAmountUSD` | number | YES | > 0 | Output amount in USD |
| `inputMint` | string | YES | 44 chars | Input token mint |
| `outputMint` | string | YES | 44 chars | Output token mint |
| `inputAmount` | string | YES | Numeric | Amount in smallest units |
| `outputAmount` | string | YES | Numeric | Amount in smallest units |
| `inputDecimals` | number | YES | 0-9 | Token decimals |
| `outputDecimals` | number | YES | 0-9 | Token decimals |
| `feeTier` | string | YES | Enum | "No Tier" \| "Tier 1" \| "Tier 2" \| "Tier 3" \| "Tier 4" |
| `discountPercent` | number | YES | 0,5,10,15,20 | KNS discount applied |
| `effectiveFeeBps` | number | YES | Decimal | Effective fee basis points |
| `feeAmountUSD` | number | YES | >= 0 | Total fee charged |
| `charityAmountUSD` | number | YES | >= 0 | Charity portion |
| `kindswapFeeUSD` | number | YES | >= 0 | Platform fee portion |
| `slippageBps` | number | YES | 0-1000 | Slippage tolerance |
| `knsBalanceAtSwap` | string | YES | Numeric | User's KNS balance |
| `userAgent` | string | NO | Text | Browser info |
| `ipAddress` | string | NO | IPv4/IPv6 | Client IP |

### Response (Success)

**HTTP Status:** `201 Created`

```json
{
  "success": true,
  "signature": "5sPEHp7...(88 chars)",
  "pointsAwarded": 50,
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m"
}
```

### Response (Validation Error)

**HTTP Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Swap must be at least $5 USD",
  "error": "Bad Request"
}
```

### Response (Server Error)

**HTTP Status:** `500 Internal Server Error`

```json
{
  "statusCode": 500,
  "message": "Failed to log swap completion",
  "error": "Internal Server Error"
}
```

### Validation Rules

- Wallet: Must be 44 characters (Solana address)
- Signature: Must be 88 characters
- inputAmountUSD: Must be >= $5 (minimum for points)
- Points awarded follow daily cap: max 10,000 points/day
- All amounts must be positive

### Business Logic

1. **Validate input:** Wallet and signature format
2. **Create record:** Store in swap_transactions with status="pending"
3. **Calculate points:**
   - If inputAmountUSD >= $5: points = floor(inputAmountUSD)
   - Check daily cap: points = min(points, 10000 - swapPointsToday)
   - If points > 0: award to user_points
4. **Return response:** pointsAwarded (can be 0 if cap hit)

---

## 4. Endpoint: Get User Points

### Request

**Method:** `GET`
**Endpoint:** `/api/points/:wallet`
**Parameters:** `wallet` (path parameter, required)

### Request Example

```
GET /api/points/9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m
```

### Response (Success)

**HTTP Status:** `200 OK`

```json
{
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "totalPoints": 41700,
  "swapPoints": 25500,
  "communityPoints": 1200,
  "knsPoints": 15000,
  "currentRank": 3,
  "totalSwapVolumeUSD": "128500.50",
  "totalSwapsCount": 245,
  "averageSwapSize": "524.69"
}
```

### Response (User Not Found)

**HTTP Status:** `200 OK`

```json
{
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "totalPoints": 0,
  "swapPoints": 0,
  "communityPoints": 0,
  "knsPoints": 0,
  "totalSwapVolumeUSD": "0",
  "totalSwapsCount": 0,
  "averageSwapSize": "0"
}
```

### Response (Invalid Wallet)

**HTTP Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Invalid wallet address",
  "error": "Bad Request"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `wallet` | string | Wallet address queried |
| `totalPoints` | number | Sum of all point types |
| `swapPoints` | number | Points from swaps (1 point = $1 min $5) |
| `communityPoints` | number | Manually awarded points |
| `knsPoints` | number | KNS holding bonus points |
| `currentRank` | number | Leaderboard rank (1-100) or null |
| `totalSwapVolumeUSD` | string | Total USD value of all swaps |
| `totalSwapsCount` | number | Number of swaps executed |
| `averageSwapSize` | string | Average swap size in USD |

---

## 5. Endpoint: Get Leaderboard

### Request

**Method:** `GET`
**Endpoint:** `/api/leaderboard`
**Query Parameters:**
- `timeframe` (optional): "today" | "week" | "allTime" (default: "allTime")
- `limit` (optional): 1-1000 (default: 100)

### Request Examples

```
GET /api/leaderboard

GET /api/leaderboard?timeframe=week&limit=50

GET /api/leaderboard?timeframe=today&limit=25
```

### Response

**HTTP Status:** `200 OK`

```json
{
  "timeframe": "allTime",
  "top100": [
    {
      "rank": 1,
      "wallet": "Wallet1Address...",
      "totalPoints": 125000,
      "swapPoints": 80000,
      "communityPoints": 15000,
      "knsPoints": 30000
    },
    {
      "rank": 2,
      "wallet": "Wallet2Address...",
      "totalPoints": 115000,
      "swapPoints": 70000,
      "communityPoints": 20000,
      "knsPoints": 25000
    },
    {
      "rank": 3,
      "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
      "totalPoints": 41700,
      "swapPoints": 25500,
      "communityPoints": 1200,
      "knsPoints": 15000
    }
  ],
  "totalUsers": 100
}
```

### Leaderboard Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `rank` | number | Position in leaderboard (1-100) |
| `wallet` | string | User's wallet address |
| `totalPoints` | number | Sum of all point types |
| `swapPoints` | number | Swap-earned points |
| `communityPoints` | number | Community-awarded points |
| `knsPoints` | number | KNS holding points |

### Notes

- Ranked by `totalPoints` in descending order
- Top 100 users only
- Timeframe filtering available (implementation pending)
- Returns empty array if no users

---

## 6. Endpoint: Award Community Points

### Request

**Method:** `POST`
**Endpoint:** `/api/community/award`
**Content-Type:** `application/json`
**Authentication:** Admin (Phase 2 - not yet implemented)

### Request Body

```json
{
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "points": 500,
  "reason": "Community contributor - Discord moderator"
}
```

### Request Field Descriptions

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-----------|-------------|
| `wallet` | string | YES | 44 chars | Recipient wallet |
| `points` | number | YES | > 0 | Points to award |
| `reason` | string | YES | Min 1 char | Award reason |

### Response (Success)

**HTTP Status:** `201 Created`

```json
{
  "success": true,
  "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
  "pointsAwarded": 500,
  "totalCommunityPoints": 1700,
  "reason": "Community contributor - Discord moderator"
}
```

### Response (Weekly Cap Exceeded)

**HTTP Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Weekly community points cap is 2000. Already awarded: 1800",
  "error": "Bad Request"
}
```

### Response (Invalid Wallet)

**HTTP Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Invalid wallet address",
  "error": "Bad Request"
}
```

### Business Logic

1. **Validate inputs:** Wallet format, points >= 0, reason not empty
2. **Get or create user:** Ensure user exists in database
3. **Check weekly cap:** communityPointsThisWeek + points <= 2000
4. **Award points:** Add to both communityPoints and totalPoints
5. **Update timestamp:** Record when awarded
6. **Return response:** Confirmation with new totals

### Constraints

- Weekly cap: 2,000 community points/week
- Admin-only (future implementation)
- Points are permanent (no revocation currently)

---

## 7. Endpoint: Health Check

### Request

**Method:** `GET`
**Endpoint:** `/api/health`

### Response

**HTTP Status:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-01-13T14:22:30Z"
}
```

---

# DATA MODELS

## 1. Request DTOs (Data Transfer Objects)

### LogSwapDto

```typescript
export class LogSwapDto {
  wallet: string;                    // Solana address (44 chars)
  signature: string;                 // Tx signature (88 chars)
  inputAmountUSD: number;            // >= 5
  outputAmountUSD: number;           // > 0
  inputMint: string;                 // Token mint (44 chars)
  outputMint: string;                // Token mint (44 chars)
  inputAmount: string;               // Smallest units
  outputAmount: string;              // Smallest units
  inputDecimals: number;             // 0-9
  outputDecimals: number;            // 0-9
  feeTier: string;                   // Enum: "No Tier" | "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4"
  discountPercent: number;           // 0 | 5 | 10 | 15 | 20
  effectiveFeeBps: number;           // 10.0 | 9.5 | 9.0 | 8.5 | 8.0
  feeAmountUSD: number;              // >= 0
  charityAmountUSD: number;          // >= 0
  kindswapFeeUSD: number;            // >= 0
  routeData?: Record<string, any>;   // Optional Jupiter route data
  slippageBps: number;               // 0-1000
  knsBalanceAtSwap: string;          // Numeric string
  userAgent?: string;                // Optional browser info
  ipAddress?: string;                // Optional IP
}
```

### AwardCommunityPointsDto

```typescript
export class AwardCommunityPointsDto {
  wallet: string;                    // Solana address (44 chars)
  points: number;                    // > 0
  reason: string;                    // Min 1 character
}
```

---

## 2. Response DTOs

### SwapLogResponseDto

```typescript
export class SwapLogResponseDto {
  success: boolean;
  signature: string;
  pointsAwarded: number;
  wallet: string;
}
```

### UserPointsResponseDto

```typescript
export class UserPointsResponseDto {
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
  currentRank?: number;
  totalSwapVolumeUSD: string;
  totalSwapsCount: number;
  averageSwapSize: string;
}
```

### LeaderboardEntryDto

```typescript
export class LeaderboardEntryDto {
  rank: number;
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
}
```

### LeaderboardResponseDto

```typescript
export class LeaderboardResponseDto {
  timeframe: 'today' | 'week' | 'allTime';
  top100: LeaderboardEntryDto[];
  totalUsers: number;
}
```

---

# INTEGRATION GUIDE

## 1. Frontend to Backend Integration

### Step 1: Swap Completion

After Jupiter swap execution on frontend:

```javascript
const logSwap = async (swapData) => {
  const response = await fetch('http://localhost:3000/api/swap/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: swapData.wallet,
      signature: swapData.signature,
      inputAmountUSD: swapData.inputAmountUSD,
      outputAmountUSD: swapData.outputAmountUSD,
      inputMint: swapData.inputMint,
      outputMint: swapData.outputMint,
      inputAmount: swapData.inputAmount,
      outputAmount: swapData.outputAmount,
      inputDecimals: swapData.inputDecimals,
      outputDecimals: swapData.outputDecimals,
      feeTier: swapData.feeTier,
      discountPercent: swapData.discountPercent,
      effectiveFeeBps: swapData.effectiveFeeBps,
      feeAmountUSD: swapData.feeAmountUSD,
      charityAmountUSD: swapData.charityAmountUSD,
      kindswapFeeUSD: swapData.kindswapFeeUSD,
      slippageBps: swapData.slippageBps,
      knsBalanceAtSwap: swapData.knsBalance.toString(),
      userAgent: navigator.userAgent,
      ipAddress: await getClientIP(),
    })
  });

  const result = await response.json();
  console.log(`Points awarded: ${result.pointsAwarded}`);
  return result;
};
```

### Step 2: Display User Points

```javascript
const fetchUserPoints = async (wallet) => {
  const response = await fetch(`http://localhost:3000/api/points/${wallet}`);
  const points = await response.json();

  return {
    total: points.totalPoints,
    fromSwaps: points.swapPoints,
    fromCommunity: points.communityPoints,
    fromKNS: points.knsPoints,
    rank: points.currentRank,
  };
};
```

### Step 3: Display Leaderboard

```javascript
const fetchLeaderboard = async () => {
  const response = await fetch('http://localhost:3000/api/leaderboard?limit=100');
  const data = await response.json();

  return data.top100.map((entry, idx) => ({
    rank: entry.rank,
    wallet: entry.wallet,
    points: entry.totalPoints,
  }));
};
```

---

## 2. Error Handling

### Frontend Implementation

```javascript
const handleSwapLog = async (swapData) => {
  try {
    const response = await fetch('http://localhost:3000/api/swap/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swapData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    console.log(`Successfully awarded ${result.pointsAwarded} points`);
    return result;
  } catch (error) {
    console.error('Failed to log swap:', error.message);
    // Show user-friendly error message
    showNotification(`Error: ${error.message}`, 'error');
  }
};
```

---

# ERROR HANDLING

## HTTP Status Codes

| Status | Meaning | Scenario |
|--------|---------|----------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST request |
| 400 | Bad Request | Invalid input, validation failed |
| 401 | Unauthorized | Auth required (future) |
| 500 | Server Error | Database or internal error |

## Common Errors

### 400 Bad Request: Invalid Wallet

```json
{
  "statusCode": 400,
  "message": "Invalid wallet address",
  "error": "Bad Request"
}
```

**Fix:** Ensure wallet is exactly 44 characters (Solana base58 format)

### 400 Bad Request: Swap Below Minimum

```json
{
  "statusCode": 400,
  "message": "Swap must be at least $5 USD",
  "error": "Bad Request"
}
```

**Fix:** Swap value must be >= $5 for points

### 400 Bad Request: Weekly Cap Exceeded

```json
{
  "statusCode": 400,
  "message": "Weekly community points cap is 2000. Already awarded: 1800",
  "error": "Bad Request"
}
```

**Fix:** Reset occurs automatically each week. Wait for next week or use fewer points.

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Failed to log swap completion",
  "error": "Internal Server Error"
}
```

**Fix:** Check server logs. Likely database connection issue.

---

## Testing Endpoints

### Using cURL

```bash
# Log a swap
curl -X POST http://localhost:3000/api/swap/complete \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m",
    "signature": "5sPEHp7...",
    "inputAmountUSD": 50,
    ...
  }'

# Get user points
curl http://localhost:3000/api/points/9B5X6n7ymQKb5AyqL6hgcjEQxzDH3N6X2vPeN1vvyM4m

# Get leaderboard
curl http://localhost:3000/api/leaderboard?limit=10

# Health check
curl http://localhost:3000/api/health
```

### Using Postman

1. Create collection "KindSwap Points API"
2. Create requests for each endpoint
3. Use variables for `{{base_url}}` and `{{wallet}}`
4. Save example responses for documentation

---

## Document Metadata

| Property | Value |
|----------|-------|
| Title | KindSwap Points System - API & Schema |
| Version | 1.0.0 |
| Created | 2026-01-13 |
| Last Updated | 2026-01-13 |
| Status | Production Ready |
| Database | PostgreSQL 16 |
| ORM | TypeORM 0.3.28 |
| Framework | NestJS 11 |

---

**End of Document**
