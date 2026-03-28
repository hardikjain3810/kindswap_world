# CLIENT IMPLEMENTATION GUIDE — Pritunl VPN + Secret Management

**For:** KindSwap Team  
**Date:** March 28, 2026  
**Status:** Ready for Implementation  

---

## QUICK START — WHAT YOU NEED TO DO

### Day 1: Admin Setup (Infrastructure Lead Only) — 30 minutes

**1. Enable Pritunl MFA**
```
Time: 10 minutes
Go to: https://vpn.kindswap.world/admin
Login → Settings → Enable MFA → Select TOTP → Generate Backup Codes
Store backup codes in your password manager (1Password/Bitwarden)
```

**2. Deploy AWS MFA Policy**
```
Time: 10 minutes
Run Terraform:
  cd infra/infra/infra-k8s/05-apps/terraform
  terraform apply -target=aws_iam_policy.mfa_enforcement
```

**3. Add Team Members to AWS MFA Group**
```
Time: 10 minutes
For each team member:
  aws iam add-user-to-group \
    --user-name alice@kindswap.com \
    --group-name kindswap-devops-team
```

---

### Days 1-2: Team Member Setup (Each Person) — 15-20 minutes

**Step 1: Install Authenticator App** (Choose ONE)
- Google Authenticator (most common)
- Authy (recommended - has cloud backup)
- Microsoft Authenticator
- 1Password (if you use 1Password)

**Step 2: Setup Pritunl VPN MFA**
1. Open Pritunl portal: https://vpn.kindswap.world
2. Go to "Security" → "Two-Factor Authentication"
3. Click "Enable MFA"
4. Scan QR code with authenticator app
5. Enter the 6-digit code that appears
6. Save backup codes somewhere safe

**Step 3: Download VPN Profile**
1. Pritunl portal → "Profiles" tab
2. Click "Download"
3. Save the `.ovpn` file to your computer

**Step 4: Install VPN Client** (Choose ONE)
- macOS: Download Tunnelblick or Viscosity
- Windows: Download OpenVPN GUI
- Linux: `sudo apt install openvpn`

**Step 5: Import VPN Profile into Client**
1. Open VPN client
2. "Import Profile" → Select downloaded `.ovpn` file
3. Profile should appear in list

**Step 6: Test VPN Connection**
1. Click "Connect" in VPN client
2. When prompted: "Enter MFA Code"
3. Open authenticator app, find Pritunl entry
4. Enter 6-digit code
5. Wait 30 seconds for connection to establish
6. Status should show "Connected" ✓

**Step 7: AWS Console MFA Setup**
1. Go to AWS Console: https://console.aws.amazon.com
2. Click your username (top-right) → "Security Credentials"
3. Navigate to "Multi-Factor Authentication"
4. Click "Assign MFA device"
5. Select "Authenticator app"
6. Scan QR code with your authenticator app
7. Enter two consecutive 6-digit codes (30 seconds apart)
8. Done!

---

## WHERE SECRETS ARE STORED

### 1. Database Credentials (PostgreSQL)
**Location:** AWS Secrets Manager  
**Namespace:** `kindswap/db/prod/credentials`  
**Auto-Mounted:** In pods at `/mnt/secrets/database/credentials`  
**Refresh:** Every 120 seconds (automatic)  
**Who Has Access:** Kubernetes backend pods only (via IRSA role)

**To Retrieve:**
```bash
aws secretsmanager get-secret-value \
  --secret-id kindswap/db/prod/credentials
```

### 2. API Keys (Helius, Jupiter, CoinGecko, Sentry)
**Location:** AWS Secrets Manager  
**Namespaces:** 
- `kindswap/api/helius/prod`
- `kindswap/api/jupiter/prod`
- `kindswap/api/coingecko/prod`
- `kindswap/api/sentry/prod`

**Auto-Mounted:** In pods at `/mnt/secrets/api/`  
**Refresh:** Every 120 seconds (automatic)  
**Who Has Access:** Kubernetes backend/frontend pods only

### 3. Cosign Private Key (CI/CD Image Signing)
**Location:** AWS Secrets Manager  
**Namespace:** `kindswap/cosign/private-key`  
**Used By:** GitHub Actions CI/CD pipeline  
**Stored In:** GitHub secret `COSIGN_PRIVATE_KEY` (synced)

### 4. VPN Credentials
**Location:** Pritunl admin panel  
**Backup:** Password manager (1Password/Bitwarden) with offline copy  
**MFA Seed:** In your authenticator app ONLY (never backed up)

### 5. AWS Console Credentials
**Location:** IAM user account  
**MFA Device:** Your authenticator app  
**Backup Codes:** Password manager (saved after MFA setup)

---

## SECRET ROTATION PROCEDURES

### When to Rotate

| Secret | Frequency | Reason |
|--------|-----------|--------|
| Database password | Every 180 days | Security best practice |
| API keys | Every 180 days | Hygiene |
| Cosign signing key | On compromise | Security incident |
| AWS credentials | Never (use OIDC) | GitHub Actions uses OIDC, not keys |
| VPN backup codes | Annually or after use | Emergency access security |

### How to Rotate

**Database Password** (Admin only)

```bash
# 1. Generate new password
NEW_PASS=$(openssl rand -base64 30)

# 2. Update RDS
aws rds modify-db-instance \
  --db-instance-identifier kindswap-prod \
  --master-user-password "$NEW_PASS" \
  --apply-immediately

# 3. Update Secrets Manager
aws secretsmanager update-secret \
  --secret-id kindswap/db/prod/credentials \
  --secret-string "{\"username\":\"postgres\",\"password\":\"$NEW_PASS\",\"host\":\"...\",\"port\":5432,\"dbname\":\"kindswap\"}"

# 4. CSI driver auto-refreshes in 120 seconds
# Pods will automatically get new password
```

**API Keys**

```bash
# 1. Generate new key in service provider (Helius, etc.)
# 2. Update Secrets Manager
aws secretsmanager update-secret \
  --secret-id kindswap/api/helius/prod \
  --secret-string "{\"api_key\":\"new_key_xxx\"}"

# 3. Pod automatically gets new key in 120 seconds
# 4. Disable old key in service provider
```

---

## COMMON QUESTIONS

### Q: "I lost my authenticator app. What do I do?"

**Answer:**
1. Use a backup code to login (if you saved one)
2. Contact infrastructure team
3. Admin will reset your MFA
4. Setup MFA again on new device

### Q: "My VPN code doesn't work. Error: Invalid code"

**Answer:**
1. Check your phone time is set to automatic (not manual)
2. Wait 30 seconds, try the new code that appears
3. If still failing: sync phone time and try again
   - iPhone: Settings → General → Date & Time → Toggle "Set Automatically" OFF then ON
   - Android: Settings → System → Date & time → Toggle "Use network-provided time" OFF then ON

### Q: "I need to access secrets for debugging. How?"

**Answer:**
1. If in a pod: `kubectl exec -it <POD_NAME> -- cat /mnt/secrets/database/credentials`
2. If from your laptop: `aws secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials`
3. You must have AWS credentials with MFA
4. Logs are automatically recorded in CloudTrail

### Q: "Can I share my VPN profile with a new team member?"

**Answer:** NO! Each person needs their own:
1. Tell admin to create a new user in Pritunl
2. New person downloads THEIR OWN profile
3. New person sets up THEIR OWN authenticator
4. Never share `.ovpn` files

### Q: "What if the VPN is down? Can I still access production?"

**Answer:** NO. This is by design:
- Production API is public (https://kindswap.world)
- Admin/Staging are VPN-only
- This protects against unauthorized access

---

## EMERGENCY PROCEDURES

### If You Get Locked Out of AWS Console

**Situation:** You forgot MFA device, can't login  
**Solution:**
1. Contact infrastructure lead
2. Admin temporarily removes you from kindswap-devops-team
3. You can login without MFA (temporary)
4. Register new MFA device
5. Admin re-adds you to group

**Prevention:** Always save backup codes to password manager!

### If Database Becomes Inaccessible

**Situation:** Backend can't connect to database  
**Solution:**
1. Check Secrets Manager: Is password correct?
   ```bash
   aws secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials
   ```
2. Check RDS: Is it running?
   ```bash
   aws rds describe-db-instances --db-instance-identifier kindswap-prod
   ```
3. Check pod logs:
   ```bash
   kubectl logs -n production kindswap-backend-xxx
   ```
4. Contact DBA if database is down

### If You Suspect a Security Breach

**Immediate Actions:**
1. Notify security team in Slack: #security-incidents
2. Revoke compromised credentials immediately:
   ```bash
   aws iam delete-access-key --access-key-id AKIAXXXXX
   ```
3. If VPN compromised: Contact admin for profile reset
4. If password compromised: Change AWS password immediately
5. Enable activity monitoring in CloudTrail

---

## COMPLIANCE & AUDIT

### What's Being Logged?

**Secrets Manager Access:**
- Every `GetSecretValue` call logged to CloudTrail
- User, time, and result recorded

**VPN Access:**
- Every connection recorded in Pritunl logs
- Failed MFA attempts logged

**AWS Console:**
- Every action logged to CloudTrail
- IP address, user, action, and result recorded

**You Can Check:**
```bash
# See who accessed secrets
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --max-results 50

# See your own activity
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=<YOUR_USERNAME>
```

### Compliance Requirements

✅ All team members must use MFA  
✅ All secrets rotated every 180 days  
✅ All access logged and auditable  
✅ Backup codes stored securely (not email)  
✅ VPN profiles never shared  
✅ Database passwords never committed to git  

---

## TECHNICAL ARCHITECTURE

### Secret Flow (Data Streaming Verified ✅)

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Secrets Manager                       │
│  • kindswap/db/prod/credentials                             │
│  • kindswap/api/helius/prod                                 │
│  • Encrypted with KMS alias/kindswap-master                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  [CSI Driver]
                  (120s refresh)
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    [Pod 1]       [Pod 2]        [Pod 3]
    /mnt/secrets  /mnt/secrets   /mnt/secrets
    (mounted)     (mounted)      (mounted)
        │              │              │
        └──────────────┼──────────────┘
                       │
        [Backend processes requests]
        [Connects to RDS with rotated password]
        [Logs streamed to CloudWatch]
```

### MFA Flow

```
┌─────────────────────┐
│ Authenticator App   │  ← Your device (offline-capable)
│ (RFC 6238 TOTP)     │
└──────────┬──────────┘
           │ 6-digit code (changes every 30s)
           │
    ┌──────▼──────┐
    │  VPN Client │  ← OpenVPN/WireGuard on your laptop
    └──────┬──────┘
           │ encrypted with code
           │
    ┌──────▼──────────┐
    │ Pritunl Server  │  ← Validates TOTP matches
    └──────┬──────────┘
           │
    ┌──────▼──────────┐
    │  VPN Connected  │  ← Your laptop IP now in 10.50.x.x/16
    └─────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ AWS Security Group Rules         │
    │ Allow: 10.50.0.0/16 → ALB       │  ← VPN CIDR whitelist
    │ Deny: All other IPs             │
    └──────┬──────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ ALB Routes stg.kindswap.world    │
    │ Source IP: 10.50.x.x ✓          │
    │ Routes to staging namespace     │
    └─────────────────────────────────┘
```

---

## SUPPORT & RESOURCES

**For Pritunl VPN Issues:**
- Guide: `PRITUNL_MFA_SETUP_GUIDE.md`
- Contact: infrastructure@kindswap.com
- Emergency: Slack #infrastructure

**For AWS MFA Issues:**
- Guide: `AWS_MFA_ENFORCEMENT_GUIDE.md`
- Contact: infrastructure@kindswap.com
- Emergency: Slack #infrastructure

**For Secret Management:**
- Guide: `SECRET_MANAGEMENT.md`
- Contact: infrastructure@kindswap.com
- How to rotate: See Secret Rotation Procedures above

**For Connectivity Issues:**
- Tests: `CONNECTIVITY_VERIFICATION_TESTS.md`
- Contact: infrastructure@kindswap.com

---

## NEXT STEPS

**For Infrastructure Lead (Today):**
1. [ ] Enable Pritunl MFA
2. [ ] Deploy AWS MFA Terraform policy
3. [ ] Add team members to kindswap-devops-team

**For Each Team Member (This Week):**
1. [ ] Install authenticator app
2. [ ] Setup Pritunl MFA
3. [ ] Download VPN profile
4. [ ] Install VPN client
5. [ ] Test VPN connection
6. [ ] Setup AWS Console MFA
7. [ ] Save backup codes

**Before Go-Live (Monday):**
1. [ ] All team members have working VPN
2. [ ] All team members have AWS MFA
3. [ ] Connectivity tests pass
4. [ ] Rate limiting working
5. [ ] All systems monitoring

---

*Last Updated: March 28, 2026*  
*Status: Ready for Implementation*  
*Questions?* Contact infrastructure@kindswap.com

