# KindSwap Backend

Backend API for KindSwap - a Solana-based token swap platform with points rewards system.

## Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis
- **Runtime**: Docker

## Project Setup

```bash
npm install
```

## Running the Application

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Running with Docker

```bash
docker-compose up -d
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/kindswap
REDIS_URL=redis://localhost:6379
PORT=3000
```

---

## API Documentation

### Base URL
```
http://localhost:3000/api
```

---

## Swap & Points Endpoints

### Log Swap Transaction
Records a swap transaction (confirmed or failed). Points awarding is currently disabled.

```
POST /api/swap/complete
```

**Request Body:**
```json
{
  "wallet": "string (44 chars)",
  "signature": "string (88 chars)",
  "status": "confirmed | failed | pending | cancelled",
  "errorMessage": "string (optional, for failed txs)",
  "inputAmountUSD": 100.00,
  "outputAmountUSD": 99.50,
  "inputMint": "string (44 chars)",
  "outputMint": "string (44 chars)",
  "inputAmount": "1000000000",
  "outputAmount": "995000000",
  "inputDecimals": 9,
  "outputDecimals": 6,
  "feeTier": "Tier 2",
  "discountPercent": 10,
  "effectiveFeeBps": 9.0,
  "feeAmountUSD": 0.09,
  "charityAmountUSD": 0.0225,
  "kindswapFeeUSD": 0.0675,
  "slippageBps": 50,
  "knsBalanceAtSwap": "25000000000",
  "routeData": {},
  "userAgent": "string (optional)",
  "ipAddress": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "signature": "string",
  "pointsAwarded": 0,
  "wallet": "string",
  "feeVerification": {
    "isValid": true,
    "calculated": {
      "tierName": "Tier 2",
      "discountPercent": 10,
      "effectiveFeeBps": 9.0,
      "feeAmountUSD": 0.09,
      "charityAmountUSD": 0.0225,
      "kindswapFeeUSD": 0.0675
    },
    "frontend": {
      "tierName": "Tier 2",
      "discountPercent": 10,
      "effectiveFeeBps": 9.0,
      "feeAmountUSD": 0.09,
      "charityAmountUSD": 0.0225,
      "kindswapFeeUSD": 0.0675
    },
    "mismatches": []
  }
}
```

> **Note:** Points awarding is currently disabled. All transactions return `pointsAwarded: 0`.

### Fee Verification

The backend performs fee verification on every swap transaction:

1. **Backend Calculation**: Uses `knsBalanceAtSwap` to calculate the expected fee tier, discount, and fee amounts
2. **Comparison**: Compares frontend-provided values against backend-calculated values
3. **Storage**: **Backend-calculated values are stored** in the database for data integrity
4. **Logging**: Mismatches are logged as warnings for monitoring

**Response Fields:**
| Field | Description |
|-------|-------------|
| `isValid` | `true` if all values match within tolerance |
| `calculated` | Backend-calculated fee values |
| `frontend` | Frontend-provided fee values |
| `mismatches` | Array of mismatch descriptions (empty if valid) |

**Tolerance:**
- Fee BPS: 0.01 bps
- USD amounts: $0.01

---

### Get User Points
Retrieves a user's current points breakdown.

```
GET /api/points/:wallet
```

**Response:**
```json
{
  "wallet": "string",
  "totalPoints": 1500,
  "swapPoints": 1000,
  "communityPoints": 300,
  "knsPoints": 200,
  "currentRank": 42,
  "totalSwapVolumeUSD": "15000.00",
  "totalSwapsCount": 25,
  "averageSwapSize": "600.00"
}
```

---

### Get User Swap History
Retrieves a user's swap transaction history.

```
GET /api/swaps/:wallet?limit=50&offset=0
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Max results (up to 100) |
| offset | number | 0 | Pagination offset |

**Response:**
```json
{
  "wallet": "string",
  "swaps": [
    {
      "signature": "string",
      "wallet": "string",
      "inputMint": "string",
      "outputMint": "string",
      "inputAmount": "1000000000",
      "outputAmount": "995000000",
      "inputAmountUSD": "100.00",
      "outputAmountUSD": "99.50",
      "inputDecimals": 9,
      "outputDecimals": 6,
      "feeTier": "Tier 2",
      "discountPercent": 10,
      "effectiveFeeBps": 9.0,
      "feeAmountUSD": "0.09",
      "charityAmountUSD": "0.0225",
      "kindswapFeeUSD": "0.0675",
      "pointsAwarded": 100,
      "status": "confirmed",
      "executedAt": "2025-01-21T12:00:00Z",
      "createdAt": "2025-01-21T12:00:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

---

### Get Single Swap Transaction
Retrieves details of a specific swap by signature.

```
GET /api/swaps/transaction/:signature
```

**Response:**
```json
{
  "signature": "string",
  "wallet": "string",
  "inputMint": "string",
  "outputMint": "string",
  "inputAmount": "1000000000",
  "outputAmount": "995000000",
  "inputAmountUSD": "100.00",
  "outputAmountUSD": "99.50",
  "inputDecimals": 9,
  "outputDecimals": 6,
  "feeTier": "Tier 2",
  "discountPercent": 10,
  "effectiveFeeBps": 9.0,
  "feeAmountUSD": "0.09",
  "charityAmountUSD": "0.0225",
  "kindswapFeeUSD": "0.0675",
  "pointsAwarded": 100,
  "status": "confirmed",
  "executedAt": "2025-01-21T12:00:00Z",
  "createdAt": "2025-01-21T12:00:00Z"
}
```

---

### Get Leaderboard
Retrieves the top users by total points.

```
GET /api/leaderboard?timeframe=allTime&limit=100
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| timeframe | string | allTime | `today`, `week`, or `allTime` |
| limit | number | 100 | Max results (up to 1000) |

**Response:**
```json
{
  "timeframe": "allTime",
  "top100": [
    {
      "rank": 1,
      "wallet": "string",
      "totalPoints": 50000,
      "swapPoints": 40000,
      "communityPoints": 5000,
      "knsPoints": 5000
    }
  ],
  "totalUsers": 100
}
```

---

### Get Platform Statistics
Retrieves overall platform statistics.

```
GET /api/stats
```

**Response:**
```json
{
  "totalSwaps": 15000,
  "confirmedSwaps": 14500,
  "totalVolumeUSD": "5000000.00",
  "totalUsersCount": 2500
}
```

---

### Award Community Points (Admin)
Awards community contribution points to a user.

```
POST /api/community/award
```

**Request Body:**
```json
{
  "wallet": "string (44 chars)",
  "points": 100,
  "reason": "Community contribution description"
}
```

**Response:**
```json
{
  "success": true,
  "wallet": "string",
  "pointsAwarded": 100,
  "totalCommunityPoints": 500
}
```

---

## Fee Configuration Endpoints

### Get Fee Configuration
Returns the current fee configuration.

```
GET /api/config/fee-config
```

**Response:**
```json
{
  "baseFeeBps": 10,
  "charityPortion": 0.25,
  "kindswapPortion": 0.75,
  "updatedAt": "2025-01-21T12:00:00Z"
}
```

---

### Get All Fee Tiers
Returns all 5 fee tiers based on KNS holdings.

```
GET /api/config/fee-tiers
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "No Tier",
    "knsMin": "0",
    "discountPercent": 0,
    "effectiveFeeBps": 10.0,
    "tierOrder": 0
  },
  {
    "id": "uuid",
    "name": "Tier 1",
    "knsMin": "5000",
    "discountPercent": 5,
    "effectiveFeeBps": 9.5,
    "tierOrder": 1
  }
]
```

---

### Calculate Fee for Balance
Calculates the applicable fee tier for a given KNS balance.

```
GET /api/config/calculate-fee?knsBalance=25000
```

**Response:**
```json
{
  "knsBalance": "25000",
  "applicableTier": {
    "id": "uuid",
    "name": "Tier 2",
    "knsMin": "25000",
    "discountPercent": 10,
    "effectiveFeeBps": 9.0,
    "tierOrder": 2
  },
  "effectiveFeeBps": 9.0,
  "discountPercent": 10,
  "charityPortion": 0.25,
  "kindswapPortion": 0.75
}
```

---

### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-21T12:00:00Z"
}
```

---

## Admin Endpoints

> **Note:** These endpoints require admin authentication (TODO: implement auth guard)

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/admin/config/fee-config` | Update fee configuration |
| PUT | `/api/admin/config/fee-tiers/:id` | Update specific fee tier |
| PUT | `/api/admin/config/fee-tiers/:id/deactivate` | Deactivate a fee tier |
| PUT | `/api/admin/config/fee-tiers/:id/activate` | Reactivate a fee tier |
| GET | `/api/admin/config/audit-log/fee-config` | Get fee config change history |
| GET | `/api/admin/config/audit-log/fee-tiers` | Get fee tier change history |

---

## Database Schema

### Users Table
Stores user wallet information and KNS balance.

### User Points Table
Tracks all point types (swap, community, KNS) with daily/weekly caps.

### Swap Transactions Table
Complete audit trail of all swap transactions with:
- Transaction signature (primary key)
- Token amounts and USD values
- Fee tier and discount applied
- Points awarded
- Status tracking

### Fee Configuration Tables
- `fee_configuration` - Base fee settings
- `fee_tiers` - 5 tiers based on KNS holdings
- `fee_configuration_audit` - Change history
- `fee_tier_audit` - Tier change history

---

## Points System

> **Note:** Points awarding is currently **DISABLED**. Transactions are stored but no points are awarded.

### Swap Points (Disabled)
- **Rate**: 1 point = $1 USD
- **Minimum**: $5 USD swap required
- **Daily Cap**: 10,000 points

### Community Points
- **Range**: 50-800 points per contribution
- **Weekly Cap**: 2,000 points

### KNS Holding Points
- Points based on KNS token balance brackets
- **Range**: 0-500 points/day

---

## Fee Calculation Model (SPLIT)

### Formula
```
feeAmountUSD     = inputAmountUSD × effectiveFeeBps / 10000 (total fee, max 0.1%)
charityAmountUSD = feeAmountUSD × charityPortion (25% of total)
kindswapFeeUSD   = feeAmountUSD × kindswapPortion (75% of total)

charityPortion + kindswapPortion = 1.0
```

### Example (No Tier, charityPortion=0.25, kindswapPortion=0.75)
| Component | BPS | Percentage | Share |
|-----------|-----|------------|-------|
| **Total Fee** | **10.0** | **0.100%** | 100% |
| Charity (25%) | 2.5 | 0.025% | 25% |
| KindSwap (75%) | 7.5 | 0.075% | 75% |

### USD Calculation
```
For $100 swap at No Tier (10 bps):
- feeAmountUSD     = $100 × 10/10000 = $0.10 (total fee)
- charityAmountUSD = $0.10 × 0.25 = $0.025 (25% to charity)
- kindswapFeeUSD   = $0.10 × 0.75 = $0.075 (75% to KindSwap)
```

---

## Fee Tiers (SPLIT Model)

| Tier | KNS Required | Discount | Total Fee | Charity (25%) | KindSwap (75%) |
|------|--------------|----------|-----------|---------------|----------------|
| No Tier | 0 | 0% | 10.0 bps | 2.5 bps | 7.5 bps |
| Tier 1 | 5,000 | 5% | 9.5 bps | 2.375 bps | 7.125 bps |
| Tier 2 | 25,000 | 10% | 9.0 bps | 2.25 bps | 6.75 bps |
| Tier 3 | 100,000 | 15% | 8.5 bps | 2.125 bps | 6.375 bps |
| Tier 4 | 500,000+ | 20% | 8.0 bps | 2.0 bps | 6.0 bps |

*Total Fee is max 0.1% (10 bps), split between charity (25%) and KindSwap (75%)*

---

## Admin API: Update Fee Configuration

### Update Fee Config
```
PUT /api/admin/config/fee-config
```

**Request Body:**
```json
{
  "baseFeeBps": 10.0,
  "charityPortion": 0.25,
  "kindswapPortion": 0.75,
  "changedBy": "admin_wallet_address",
  "changeReason": "Initial setup with 25% charity portion (charityPortion + kindswapPortion = 1.0)"
}
```

### Update Fee Tier
```
PUT /api/admin/config/fee-tiers/:tierId
```

**Request Body:**
```json
{
  "knsMin": "5000",
  "discountPercent": 5,
  "effectiveFeeBps": 9.5,
  "changedBy": "admin_wallet_address",
  "changeReason": "Adjusting Tier 1 threshold"
}
```

---

## License

MIT
