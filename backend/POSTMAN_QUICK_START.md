# Postman Quick Start Guide - 5 Minutes

## Step 1: Ensure Backend is Running (30 seconds)

```bash
# Terminal 1: Start Docker services
docker-compose up -d

# Terminal 2: Start backend
cd D:\Work\KINDSOUL\kindsoul-b
npm run start:dev

# Wait for: "Nest application successfully started"
```

## Step 2: Import Postman Collection (1 minute)

### Option A: Import JSON File (Easiest)

1. **Open Postman** (download from https://www.postman.com/downloads if needed)
2. **Click** `File` (top left) → `Import`
3. **Click** `Upload Files` tab
4. **Select:** `D:\Work\KINDSOUL\kindsoul-b\POSTMAN_COLLECTION.json`
5. **Click** `Import`

### Option B: Copy-Paste JSON

1. **Open Postman**
2. **Click** `File` → `Import`
3. **Click** `Raw Text` tab
4. **Copy contents** from `POSTMAN_COLLECTION.json`
5. **Paste** into text area
6. **Click** `Import`

## Step 3: Set Variables (1 minute)

1. **In Postman**, left sidebar click collection: **"KindSwap Dynamic Fee Configuration API"**
2. **Go to** `Variables` tab
3. **Verify** these variables are set:
   - `base_url`: `http://localhost:3000`
   - `tier_id`: (leave blank for now, we'll fill it from a response)

✅ **Done!** Variables are set

## Step 4: Run Your First Request (2 minutes)

### 4.1 Get Fee Configuration

1. **Left sidebar** → Expand collection → **"PUBLIC - No Auth Required"**
2. **Click** "1. Get Current Fee Configuration"
3. **Click** blue `Send` button (right side)
4. **Response** appears in bottom panel (should see `baseFeeBps: 10.0`)

### 4.2 Get All Tiers & Extract ID

1. **Click** "2. Get All Fee Tiers"
2. **Click** `Send`
3. **In response**, find first tier ID (looks like: `"id": "550e8400..."`)
4. **Copy the ID** (without quotes)
5. **Set variable:** Click collection → `Variables` tab
6. **In `tier_id` field**, paste the ID you copied

### 4.3 Get Specific Tier

1. **Click** "3. Get Specific Tier by ID"
2. **Click** `Send`
3. ✅ Should return the specific tier details

## Step 5: Test Public Endpoints (1 minute)

Click and Send each of these:

- ✅ **"4a. Calculate Fee - No Tier (0 KNS)"** → Should show No Tier
- ✅ **"4b. Calculate Fee - Tier 1 (5k KNS)"** → Should show Tier 1 with 5% discount
- ✅ **"4c. Calculate Fee - Tier 2 (25k KNS)"** → Should show Tier 2 with 10% discount
- ✅ **"4d. Calculate Fee - Tier 3 (100k KNS)"** → Should show Tier 3 with 15% discount
- ✅ **"4e. Calculate Fee - Tier 4 (500k KNS)"** → Should show Tier 4 with 20% discount

**All working?** ✅ Congratulations! Public APIs are working

---

## Testing Admin Endpoints (2 minutes)

### Test 1: Update Fee Configuration

1. **Click** "5. Update Fee Configuration"
2. **Click** `Send`
3. **Response:** `"success": true` ✅

**Verify it worked:**
- **Click** "1. Get Current Fee Configuration"
- **Click** `Send`
- Should show updated `baseFeeBps: 10.5`

### Test 2: Update Fee Tier

1. **Click** "6. Update Fee Tier"
2. **Click** `Send`
3. **Response:** `"success": true` ✅

**Verify it worked:**
- **Click** "3. Get Specific Tier by ID"
- **Click** `Send`
- Should show updated `knsMin: "7500"`

### Test 3: View Audit Logs

1. **Click** "7. Get Fee Configuration Audit Log"
2. **Click** `Send`
3. Should see all configuration changes ✅

1. **Click** "8. Get Fee Tier Audit Log (All)"
2. **Click** `Send`
3. Should see all tier changes ✅

### Test 4: Deactivate & Reactivate Tier

1. **Click** "10. Deactivate Fee Tier"
2. **Click** `Send`
3. **Response:** `"success": true` ✅

**Verify deactivation:**
- **Click** "2. Get All Fee Tiers"
- **Click** `Send`
- The tier should be missing from the list

**Reactivate:**
1. **Click** "11. Reactivate Fee Tier"
2. **Click** `Send`
3. **Response:** `"success": true` ✅

**Verify reactivation:**
- **Click** "2. Get All Fee Tiers"
- **Click** `Send`
- The tier should be back in the list

---

## ✅ Testing Complete!

If all tests passed, you have successfully tested:

### Public Endpoints (No Auth)
- ✅ Get fee configuration
- ✅ Get all fee tiers
- ✅ Get specific tier
- ✅ Calculate fee for any KNS balance
- ✅ Fee calculation for all 5 tiers

### Admin Endpoints (Auth TODO)
- ✅ Update fee configuration
- ✅ Update fee tier
- ✅ View configuration audit log
- ✅ View tier audit logs
- ✅ Deactivate tier
- ✅ Reactivate tier

---

## Troubleshooting

### "Connection refused" Error

**Problem:** Cannot connect to backend

**Solution:**
```bash
# Check if backend is running
npm run start:dev

# Check if port 3000 is in use
netstat -an | findstr 3000
```

### "No active fee configuration found" Error

**Problem:** Database not seeded

**Solution:**
```bash
# Check database
psql -h localhost -U dbpass -d kindsoul_db -c "SELECT * FROM fee_configuration;"

# If empty, migration didn't run
# Restart backend:
npm run start:dev
```

### Response Shows Different Values

**Problem:** Cached values from previous run

**Solution:**
- Restart backend: `Ctrl+C` then `npm run start:dev`
- Or wait 1 hour for Redis cache to expire

### "Invalid UUID format" Error

**Problem:** tier_id variable is wrong

**Solution:**
1. **Click** "2. Get All Fee Tiers" and `Send`
2. **Copy** first `id` value from response
3. **Set** collection `Variables` tab → `tier_id` = the copied value
4. **Try request again**

---

## Tips & Tricks

### Revert to Original Values

If you changed values and want to go back:

1. **Click** "5. Update Fee Configuration"
2. **Change body to:**
```json
{
  "baseFeeBps": 10.0,
  "charityPortion": 0.5,
  "kindswapPortion": 0.5,
  "changeReason": "Reverting to original values"
}
```
3. **Click** `Send`

### View Request/Response Details

- **Click** response tab (bottom)
- **View:**
  - `Body` - JSON response data
  - `Headers` - Response headers and status
  - `Timeline` - Request timing breakdown
  - `Tests` - Validation tests (if added)

### Save Custom Requests

1. **Make changes** to a request body
2. **Right-click** request name
3. **Click** `Save as...` to create custom version

---

## Next Steps

Once all tests pass:

1. ✅ **Check:** All endpoints working
2. ⏳ **Fix:** Any errors (see Troubleshooting)
3. ⏳ **Document:** What you tested
4. ⏳ **Proceed:** Phase 5 - Frontend Integration

---

## More Details

For detailed testing guide with curl examples and explanations:

📖 **Read:** `TESTING_GUIDE.md` in the same directory

---

**Questions?** Check the implementation summary: `DYNAMIC_FEE_CONFIG_IMPLEMENTATION.md`
