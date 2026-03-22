# Dynamic Fee Configuration API - Testing Guide

**Last Updated:** January 13, 2026
**API Base URL:** `http://localhost:3000`

---

## Prerequisites

### 1. Ensure All Services Are Running

```bash
# Terminal 1: Start PostgreSQL & Redis (Docker Compose)
docker-compose up -d

# Check services are running
docker ps
# Should see: postgres:16-alpine and redis:7-alpine

# Verify PostgreSQL
psql -h localhost -U dbpass -d kindsoul_db -c "SELECT version();"

# Verify Redis
redis-cli ping
# Should respond: PONG
```

### 2. Start the Backend Server

```bash
cd D:\Work\KINDSOUL\kindsoul-b

# Install dependencies (first time only)
npm install

# Start development server
npm run start:dev

# You should see:
# [Nest] 12345 - 01/13/2026, 2:30:00 PM     LOG [NestFactory] Nest application successfully started +2ms
# Server listening on port 3000
```

### 3. Verify Database & Migrations

```bash
# Check if migration ran successfully
psql -h localhost -U dbpass -d kindsoul_db -c "\dt"

# You should see 4 new tables:
# - fee_configuration
# - fee_tiers
# - fee_configuration_audit
# - fee_tier_audit

# Verify seed data
psql -h localhost -U dbpass -d kindsoul_db -c "SELECT * FROM fee_tiers;"

# Should show 5 tiers:
# No Tier, Tier 1, Tier 2, Tier 3, Tier 4
```

---

## Testing Steps

### Step 1: Verify API Server is Running

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Expected Response:
# {
#   "status": "ok",
#   "timestamp": "2026-01-13T14:22:30Z"
# }
```

### Step 2: Test PUBLIC Endpoints (No Auth Required)

#### 2.1 Get Current Fee Configuration

```bash
curl http://localhost:3000/api/config/fee-config

# Expected Response (200 OK):
# {
#   "baseFeeBps": 10.0,
#   "charityPortion": 0.5,
#   "kindswapPortion": 0.5,
#   "updatedAt": "2026-01-13T14:22:30Z"
# }
```

#### 2.2 Get All Fee Tiers

```bash
curl http://localhost:3000/api/config/fee-tiers

# Expected Response (200 OK):
# [
#   {
#     "id": "550e8400-e29b-41d4-a716-446655440000",
#     "name": "No Tier",
#     "knsMin": "0",
#     "discountPercent": 0,
#     "effectiveFeeBps": 10.0,
#     "tierOrder": 0
#   },
#   {
#     "id": "550e8400-e29b-41d4-a716-446655440001",
#     "name": "Tier 1",
#     "knsMin": "5000",
#     "discountPercent": 5,
#     "effectiveFeeBps": 9.5,
#     "tierOrder": 1
#   },
#   ...
# ]
```

#### 2.3 Get Specific Tier by ID

```bash
# First, get a tier ID from the previous response
# Then use it in this request:

curl http://localhost:3000/api/config/fee-tiers/550e8400-e29b-41d4-a716-446655440000

# Expected Response (200 OK):
# {
#   "id": "550e8400-e29b-41d4-a716-446655440000",
#   "name": "No Tier",
#   "knsMin": "0",
#   "discountPercent": 0,
#   "effectiveFeeBps": 10.0,
#   "tierOrder": 0
# }
```

#### 2.4 Calculate Fee for KNS Balance

```bash
# Test with 100,000 KNS (should be Tier 3)
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=100000"

# Expected Response (200 OK):
# {
#   "tier": {
#     "id": "550e8400-e29b-41d4-a716-446655440003",
#     "name": "Tier 3",
#     "knsMin": "100000",
#     "discountPercent": 15,
#     "effectiveFeeBps": 8.5,
#     "tierOrder": 3
#   },
#   "effectiveFeeBps": 8.5,
#   "discountPercent": 15,
#   "charityPortion": 0.5
# }

# Test with different balances:
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=0"         # No Tier
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=5000"      # Tier 1
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=25000"     # Tier 2
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=100000"    # Tier 3
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=500000"    # Tier 4
curl "http://localhost:3000/api/config/calculate-fee?knsBalance=1000000"   # Tier 4 (max)
```

### Step 3: Test ADMIN Endpoints (Auth TODO - Currently Unprotected)

#### 3.1 Update Fee Configuration

```bash
curl -X PUT http://localhost:3000/api/admin/config/fee-config \
  -H "Content-Type: application/json" \
  -d '{
    "baseFeeBps": 10.5,
    "changeReason": "Testing fee update - increase base fee by 0.5 bps"
  }'

# Expected Response (200 OK):
# {
#   "success": true,
#   "message": "Fee configuration updated successfully"
# }

# Verify the change:
curl http://localhost:3000/api/config/fee-config
# Should show baseFeeBps: 10.5
```

#### 3.2 Update Fee Tier

```bash
# Get a tier ID first
TIER_ID="550e8400-e29b-41d4-a716-446655440001"

# Update Tier 1 KNS minimum from 5,000 to 7,500
curl -X PUT http://localhost:3000/api/admin/config/fee-tiers/$TIER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "knsMin": "7500",
    "changeReason": "Increased Tier 1 minimum from 5k to 7.5k KNS"
  }'

# Expected Response (200 OK):
# {
#   "success": true,
#   "message": "Fee tier <id> updated successfully"
# }

# Verify the change:
curl http://localhost:3000/api/config/fee-tiers/$TIER_ID
# Should show knsMin: "7500"
```

#### 3.3 Get Fee Configuration Audit History

```bash
curl "http://localhost:3000/api/admin/config/audit-log/fee-config?limit=10"

# Expected Response (200 OK):
# [
#   {
#     "id": "660e8400-e29b-41d4-a716-446655440000",
#     "baseFeeBps": 10.5,
#     "charityPortion": 0.5,
#     "kindswapPortion": 0.5,
#     "changedBy": "TODO_FROM_AUTH",
#     "changeReason": "Testing fee update - increase base fee by 0.5 bps",
#     "changedAt": "2026-01-13T14:22:30Z"
#   },
#   ...
# ]
```

#### 3.4 Get Fee Tier Audit History

```bash
# Get all tier audit records
curl "http://localhost:3000/api/admin/config/audit-log/fee-tiers?limit=20"

# Get audit for specific tier
TIER_ID="550e8400-e29b-41d4-a716-446655440001"
curl "http://localhost:3000/api/admin/config/audit-log/fee-tiers?tierId=$TIER_ID&limit=10"

# Expected Response (200 OK):
# [
#   {
#     "id": "660e8400-e29b-41d4-a716-446655440001",
#     "tierId": "550e8400-e29b-41d4-a716-446655440001",
#     "name": "Tier 1",
#     "knsMin": "7500",
#     "discountPercent": 5,
#     "effectiveFeeBps": 9.5,
#     "changedBy": "TODO_FROM_AUTH",
#     "changeReason": "Increased Tier 1 minimum from 5k to 7.5k KNS",
#     "changedAt": "2026-01-13T14:22:30Z"
#   },
#   ...
# ]
```

#### 3.5 Deactivate a Tier

```bash
# Get Tier 1 ID
TIER_ID="550e8400-e29b-41d4-a716-446655440001"

# Deactivate
curl -X PUT http://localhost:3000/api/admin/config/fee-tiers/$TIER_ID/deactivate

# Expected Response (200 OK):
# {
#   "success": true,
#   "message": "Fee tier <id> deactivated successfully"
# }

# Verify (getFeeTiers should not include deactivated tier):
curl http://localhost:3000/api/config/fee-tiers
# Tier 1 should be missing from the list
```

#### 3.6 Reactivate a Tier

```bash
TIER_ID="550e8400-e29b-41d4-a716-446655440001"

# Reactivate
curl -X PUT http://localhost:3000/api/admin/config/fee-tiers/$TIER_ID/activate

# Expected Response (200 OK):
# {
#   "success": true,
#   "message": "Fee tier <id> reactivated successfully"
# }

# Verify (getFeeTiers should include the tier again):
curl http://localhost:3000/api/config/fee-tiers
# Tier 1 should be back in the list
```

---

## Postman Setup Instructions

### Method 1: Import from JSON (Fastest)

1. **Download Postman Collection**
   - Copy the JSON from `POSTMAN_COLLECTION.json` (see next section)

2. **Import into Postman**
   - Open Postman
   - Click `File` → `Import`
   - Paste the JSON or select the file
   - Collection appears in left sidebar

3. **Set Variables**
   - Click collection name
   - Go to `Variables` tab
   - Set `base_url` = `http://localhost:3000`
   - Set `tier_id` = (get from first "Get Tiers" request response)

4. **Run Requests**
   - Expand collection in left sidebar
   - Click any request
   - Click `Send` button
   - View response in bottom panel

### Method 2: Manual Setup in Postman

1. **Create Collection**
   - New → Collection → "KindSwap Fee Config API"

2. **Create Environment**
   - New → Environment
   - Add variables:
     - `base_url` = `http://localhost:3000`
     - `tier_id` = (leave blank, fill after first request)

3. **Add Requests** (see examples below)

---

## Postman Request Examples

### Request Template: Get Fee Configuration

```
GET http://localhost:3000/api/config/fee-config

Headers:
- Content-Type: application/json

Response (200 OK):
{
  "baseFeeBps": 10.0,
  "charityPortion": 0.5,
  "kindswapPortion": 0.5,
  "updatedAt": "2026-01-13T14:22:30Z"
}
```

### Request Template: Update Fee Configuration

```
PUT http://localhost:3000/api/admin/config/fee-config

Headers:
- Content-Type: application/json

Body (JSON):
{
  "baseFeeBps": 10.5,
  "charityPortion": 0.48,
  "kindswapPortion": 0.52,
  "changeReason": "Q1 2026 fee adjustment - slight increase in platform portion"
}

Response (200 OK):
{
  "success": true,
  "message": "Fee configuration updated successfully"
}
```

### Request Template: Update Fee Tier

```
PUT http://localhost:3000/api/admin/config/fee-tiers/{{tier_id}}

Headers:
- Content-Type: application/json

Body (JSON):
{
  "discountPercent": 8,
  "effectiveFeeBps": 9.2,
  "changeReason": "Increased Tier 1 discount from 5% to 8%"
}

Response (200 OK):
{
  "success": true,
  "message": "Fee tier ... updated successfully"
}
```

### Request Template: Calculate Fee

```
GET http://localhost:3000/api/config/calculate-fee?knsBalance=100000

Headers:
- Content-Type: application/json

Response (200 OK):
{
  "tier": {
    "id": "...",
    "name": "Tier 3",
    "knsMin": "100000",
    "discountPercent": 15,
    "effectiveFeeBps": 8.5,
    "tierOrder": 3
  },
  "effectiveFeeBps": 8.5,
  "discountPercent": 15,
  "charityPortion": 0.5
}
```

---

## Error Handling & Troubleshooting

### Error: Connection Refused (Port 3000)

**Cause:** Backend server not running

**Solution:**
```bash
# Terminal 1: Start server
cd D:\Work\KINDSOUL\kindsoul-b
npm run start:dev

# Wait for: "Nest application successfully started"
```

### Error: Database Connection Error

**Cause:** PostgreSQL not running or wrong credentials

**Solution:**
```bash
# Check .env file
cat D:\Work\KINDSOUL\kindsoul-b\.env

# Verify PostgreSQL running
docker ps | grep postgres

# If not running:
docker-compose up -d postgres

# Verify connection
psql -h localhost -U dbpass -d kindsoul_db -c "SELECT 1;"
```

### Error: Redis Connection Failed

**Cause:** Redis not running or wrong config

**Solution:**
```bash
# Verify Redis running
docker ps | grep redis

# If not running:
docker-compose up -d redis

# Test connection
redis-cli ping
# Should respond: PONG

# Check Redis config in .env
grep REDIS D:\Work\KINDSOUL\kindsoul-b\.env
```

### Error: "No active fee configuration found"

**Cause:** Migration didn't run or seed data missing

**Solution:**
```bash
# Verify migration ran
psql -h localhost -U dbpass -d kindsoul_db -c "SELECT * FROM fee_configuration;"

# If empty, manually seed:
psql -h localhost -U dbpass -d kindsoul_db -c "
INSERT INTO fee_configuration (id, base_fee_bps, charity_portion, kindswap_portion, is_active, notes)
VALUES (gen_random_uuid(), 10.0, 0.5, 0.5, true, 'Manual seed');"
```

### Error: 400 Bad Request

**Cause:** Invalid request body or parameters

**Solution:**
- Check request body is valid JSON
- Verify all required fields are present
- Check field types match expected values

### Error: 500 Internal Server Error

**Cause:** Server-side issue

**Solution:**
- Check server logs: `npm run start:dev` output
- Verify database connection
- Check Redis connection

---

## Testing Checklist

### Phase 1: Connectivity
- [ ] Backend server starts without errors
- [ ] Database connection successful
- [ ] Redis connection successful
- [ ] Health endpoint responds

### Phase 2: Public Endpoints
- [ ] GET /config/fee-config returns correct data
- [ ] GET /config/fee-tiers returns 5 tiers
- [ ] GET /config/fee-tiers/:id returns specific tier
- [ ] GET /config/calculate-fee works for different balances

### Phase 3: Admin Endpoints
- [ ] PUT /admin/config/fee-config updates configuration
- [ ] PUT /admin/config/fee-tiers/:id updates tier
- [ ] GET /admin/config/audit-log/fee-config shows history
- [ ] GET /admin/config/audit-log/fee-tiers shows history
- [ ] PUT /admin/config/fee-tiers/:id/deactivate works
- [ ] PUT /admin/config/fee-tiers/:id/activate works

### Phase 4: Caching
- [ ] First request is slower (DB query)
- [ ] Second request is faster (Redis cache)
- [ ] Cache invalidates after admin update
- [ ] New request fetches from DB again

### Phase 5: Audit Trail
- [ ] Each admin action creates audit record
- [ ] Audit includes: admin wallet, reason, timestamp
- [ ] Can view full history

---

## Performance Benchmarks

**Expected Response Times:**

| Endpoint | First Request | Cached | Note |
|----------|---------------|--------|------|
| GET /config/fee-config | 50-100ms | <5ms | DB + Redis cache |
| GET /config/fee-tiers | 75-150ms | <5ms | DB + Redis cache |
| PUT /admin/config/* | 100-200ms | - | Always hits DB |
| GET /calculate-fee | 50-100ms | <5ms | Uses cached tiers |

---

## Next Steps

Once testing is complete:

1. ✅ Verify all endpoints working
2. ⏳ Fix any errors (see Troubleshooting)
3. ⏳ Proceed with Frontend Integration (Phase 5)
4. ⏳ Implement Admin Authentication
5. ⏳ Create Admin UI Panel

---

**Support:** Check implementation summary for technical details: `DYNAMIC_FEE_CONFIG_IMPLEMENTATION.md`
