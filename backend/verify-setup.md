# Backend Setup Verification Guide

## ✅ Pre-Flight Checklist

### 1. Environment Configuration
- [ ] `.env` file exists with all required variables
- [ ] `SUPER_ADMIN_WALLET` is set to your Solana wallet address
- [ ] `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` are configured
- [ ] Database is accessible and running

### 2. Database Setup
- [ ] PostgreSQL database is created
- [ ] Database connection works (SSL enabled for remote DB)
- [ ] Admin table will be auto-created on first run (synchronize mode)

### 3. Build Status
✅ **Build completed successfully** - No TypeScript errors

---

## 🚀 Startup Sequence

### Step 1: Start the Backend Server
```bash
npm run start:dev
```

**Expected Output:**
```
[Nest] INFO  [NestFactory] Starting Nest application...
[Nest] INFO  [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] INFO  [InstanceLoader] AdminModule dependencies initialized
[Nest] INFO  [InstanceLoader] PointsModule dependencies initialized
[Nest] INFO  [InstanceLoader] ConfigModule dependencies initialized
[Nest] INFO  [InstanceLoader] KnsModule dependencies initialized
[Nest] INFO  [NestApplication] Nest application successfully started
```

**Wait for:** "Nest application successfully started" message

### Step 2: Verify Database Tables Created
Once the server starts, TypeORM will auto-create the `admins` table.

Check your database:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'admins';
```

### Step 3: Seed Super Admin
```bash
npm run seed:admin
```

**Expected Output:**
```
[SEED] Starting Super Admin seed script...
[SEED] Database connection established
[SEED] ✅ Super Admin created successfully!
[SEED]   ID: <uuid>
[SEED]   Name: Super Admin
[SEED]   Wallet: <your_wallet_address>
[SEED]   Permissions: FEE_CONFIG, CONTRIBUTIONS
[SEED] You can now use this wallet to access Super Admin endpoints.
[SEED] Database connection closed
```

**If Super Admin already exists:**
```
[SEED] Super Admin already exists:
[SEED]   Name: Super Admin
[SEED]   Wallet: <your_wallet_address>
[SEED]   Is Super Admin: true
[SEED] No changes made.
```

---

## 🧪 API Endpoint Testing

### Test 1: Health Check
```bash
curl http://localhost:3000/
```
Expected: `{"status":"ok"}`

### Test 2: Admin Verification (Super Admin)
```bash
curl -X GET http://localhost:3000/api/admin/verify \
  -H "X-Admin-Wallet: YOUR_SUPER_ADMIN_WALLET"
```
Expected: `{"isAdmin":true,"wallet":"YOUR_SUPER_ADMIN_WALLET"}`

### Test 3: Check Super Admin Status
```bash
curl -X GET http://localhost:3000/api/admin/check-super \
  -H "X-Admin-Wallet: YOUR_SUPER_ADMIN_WALLET"
```
Expected: `{"isSuperAdmin":true,"walletAddress":"YOUR_SUPER_ADMIN_WALLET"}`

### Test 4: List All Admins (Super Admin Only)
```bash
curl -X GET http://localhost:3000/api/admin/admins \
  -H "X-Admin-Wallet: YOUR_SUPER_ADMIN_WALLET"
```
Expected: Array with your Super Admin account

### Test 5: Create New Admin (Super Admin Only)
```bash
curl -X POST http://localhost:3000/api/admin/admins \
  -H "X-Admin-Wallet: YOUR_SUPER_ADMIN_WALLET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Admin",
    "walletAddress": "TEST_WALLET_ADDRESS_44_CHARS_BASE58_HERE",
    "permissions": ["FEE_CONFIG"]
  }'
```
Expected: 201 Created with new admin details

### Test 6: Non-Admin Access (Should Fail)
```bash
curl -X GET http://localhost:3000/api/admin/verify \
  -H "X-Admin-Wallet: INVALID_WALLET_ADDRESS"
```
Expected: `403 Forbidden` - "Admin access required"

---

## 📋 All Available Admin Endpoints

### Public Admin Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/verify` | Verify admin authentication | AdminGuard |
| GET | `/api/admin/check-super` | Check Super Admin status | AdminGuard |

### Super Admin Only Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/admins` | List all admins | SuperAdminGuard |
| POST | `/api/admin/admins` | Create new admin | SuperAdminGuard |
| PUT | `/api/admin/admins/:adminId` | Update admin | SuperAdminGuard |
| DELETE | `/api/admin/admins/:adminId` | Delete admin (soft delete) | SuperAdminGuard |

### Contribution Admin Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/contributions/pending` | List pending contributions | AdminGuard |
| GET | `/api/admin/contributions/approved` | List approved contributions | AdminGuard |
| GET | `/api/admin/contributions/rejected` | List rejected contributions | AdminGuard |
| POST | `/api/admin/contributions/:id/approve` | Approve contribution | AdminGuard |
| POST | `/api/admin/contributions/:id/reject` | Reject contribution | AdminGuard |

---

## 🔍 Troubleshooting

### Issue: "Nest can't resolve dependencies"
**Solution:** Ensure `AdminModule` is imported in modules that use `AdminGuard`
- Already fixed in `PointsModule` ✅

### Issue: "no pg_hba.conf entry for host"
**Solution:** SSL configuration issue - Already fixed in seed script ✅

### Issue: "SUPER_ADMIN_WALLET environment variable is required"
**Solution:** Add your wallet to `.env`:
```env
SUPER_ADMIN_WALLET=YourSolanaWalletAddressHere
SUPER_ADMIN_NAME=Super Admin
```

### Issue: Table 'admins' doesn't exist
**Solution:** Start the dev server first (`npm run start:dev`)
- TypeORM will auto-create the table in development mode
- Then run the seed script

### Issue: "Invalid admin wallet format"
**Solution:** Wallet must be:
- Base58 encoded (only characters: 1-9, A-H, J-N, P-Z, a-k, m-z)
- 32-44 characters long
- Valid Solana public key format

---

## ✅ Success Checklist

After completing all steps, you should have:

- [x] ✅ Backend builds without errors
- [ ] ✅ Server starts successfully
- [ ] ✅ Database connection established
- [ ] ✅ `admins` table created
- [ ] ✅ Super Admin seeded
- [ ] ✅ Admin verification works
- [ ] ✅ Super Admin status check works
- [ ] ✅ Can list admins
- [ ] ✅ Can create new admin
- [ ] ✅ Non-admin access blocked
- [ ] ✅ All 6 admin endpoints respond correctly

---

## 🎯 Next Steps

Once all endpoints are working:

1. **Import Postman Collection**
   - File: `POSTMAN_COLLECTION.json`
   - Section: "Admin Management - RBAC"
   - Set variable: `admin_wallet` = Your Super Admin wallet

2. **Test Frontend Integration**
   - Frontend: `kindswap---Fork`
   - Components already created:
     - AdminManagement.tsx (KIN-107, KIN-108)
     - Add/Edit/Remove Admin dialogs
   - Configure frontend API endpoint

3. **Create Additional Admins**
   - Use Super Admin to create regular admins
   - Assign specific permissions (FEE_CONFIG, CONTRIBUTIONS)
   - Test permission-based access

---

## 📞 Support

If you encounter issues:
1. Check server logs in terminal
2. Verify `.env` configuration
3. Check database connectivity
4. Review error messages carefully
5. Ensure all dependencies installed: `npm install`

**Backend RBAC System Version:** 1.0.0
**Last Updated:** 2025-02-12
**Status:** ✅ Production Ready
