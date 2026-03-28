# S5 & S7 Implementation Guide — Cloudflare Rate Limiting & MFA Enforcement
**Document:** Saturday Execution Plan (S5, S7) Implementation  
**Date:** March 28, 2026  
**Scope:** us-east-1 region only  

---

## S5 — Dual-Layer Rate Limiting Implementation

### Layer 1 — Cloudflare Edge Rate Limiting (NEW)

**Status:** Ready for deployment via Terraform or manual configuration

#### Option A: Terraform Deployment (Recommended)

**Prerequisites:**
1. Cloudflare account with kindswap.world zone
2. Cloudflare API token with rate-limiting permissions
3. Terraform configured with Cloudflare provider

**Steps:**

1. **Set Cloudflare API Token:**
```bash
export TF_VAR_cloudflare_api_token="your-cloudflare-api-token"
```

2. **Get Cloudflare Zone ID:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones?name=kindswap.world" \
  -H "Authorization: Bearer $TF_VAR_cloudflare_api_token" \
  -H "Content-Type: application/json" | jq '.result[0].id'
```

3. **Set Zone ID:**
```bash
export TF_VAR_cloudflare_zone_id="<zone-id-from-above>"
```

4. **Apply Terraform:**
```bash
cd infra/infra/infra-k8s/05-apps
terraform init
terraform apply -target=cloudflare_rate_limit.api_rate_limit
```

5. **Verify Deployment:**
```bash
terraform output cloudflare_rate_limit_id
terraform output cloudflare_rate_limit_description
```

**Configuration Applied:**
- Path: `/api/*`
- Threshold: 15 requests per 60 seconds per IP
- Action: Challenge (shows CAPTCHA)
- Status: Active

#### Option B: Manual Configuration (Cloudflare Dashboard)

**Steps:**

1. Log into Cloudflare dashboard (kindswap.world zone)
2. Navigate to **Security → WAF → Rate Limiting Rules**
3. Click **Create rule**
4. Configure:
   - **URI Path:** `/api/*`
   - **Threshold:** 15 requests per 60 seconds
   - **Response:** Challenge (or Block for stricter enforcement)
   - **Rule Name:** "KindSwap API Rate Limiting (SoW v5)"
5. Click **Deploy**
6. Verify rule status shows **Active** ✅

### Layer 2 — NestJS Application Rate Limiting (COMPLETED)

**Status:** ✅ FIXED

**Implemented Changes:**

1. **Throttle Limit Updated (app.module.ts):**
   - Changed from: 100 requests/min
   - Changed to: 15 requests/min (per SoW v5)

2. **@SkipThrottle Added (app.controller.ts):**
   - Health endpoint now excluded from rate limiting
   - Prevents liveness probe failures under load
   - Monitoring endpoints protected from throttling

**Testing Layer 2:**

```bash
# Test 1: Health endpoint should NOT be rate-limited
for i in {1..20}; do curl http://kindswap-backend:5000/health; done
# Expected: All requests succeed

# Test 2: API endpoint should be rate-limited after 15 requests
for i in {1..20}; do curl http://kindswap-backend:5000/api/test; done
# Expected: 1-15 succeed, 16+ return HTTP 429 (Too Many Requests)

# Test 3: Verify Retry-After header
curl -i http://kindswap-backend:5000/api/test
# Expected: Headers should include "Retry-After: 60"
```

### Testing Both Layers

**Test A: Edge Rate Limiting (Layer 1)**

```bash
# From outside VPN (to test Cloudflare edge)
curl -I https://kindswap.world/api/test
curl -I https://kindswap.world/api/test
# After ~15 requests:
# Expected: HTTP 429 (Too Many Requests)
```

**Test B: Application Rate Limiting (Layer 2)**

```bash
# From within VPN (bypasses Cloudflare, tests NestJS)
curl http://staging-backend:5000/api/test
# Repeat 16 times rapidly
# Expected: 1-15 succeed, 16+ return HTTP 429
```

**Test C: CloudWatch Monitoring**

```bash
# Check CloudWatch for 429 responses
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_4XX_Count \
  --dimensions Name=TargetGroup,Value=kindswap-backend \
  --statistics Sum \
  --start-time 2026-03-28T00:00:00Z \
  --end-time 2026-03-28T23:59:59Z \
  --period 3600
```

---

## S7 — MFA Enforcement Implementation

### Part 1 — AWS Console MFA (Terraform)

**Status:** Ready for deployment

#### Deployment Steps:

1. **Deploy Terraform Configuration:**
```bash
cd infra/infra/infra-k8s/05-apps
terraform apply -target=aws_iam_policy.mfa_enforcement
terraform apply -target=aws_iam_group.devops_team
terraform apply -target=aws_iam_group_policy_attachment.devops_mfa
```

2. **Verify Policy Created:**
```bash
aws iam get-policy --policy-arn $(terraform output -raw mfa_policy_arn)
```

3. **Attach MFA Policy to IAM Users:**
```bash
# Option A: Attach to individual users
aws iam attach-user-policy \
  --user-name <username> \
  --policy-arn $(terraform output -raw mfa_policy_arn)

# Option B: Add user to group (recommended)
aws iam add-user-to-group \
  --group-name kindswap-devops-team \
  --user-name <username>
```

#### Testing AWS Console MFA:

**Test 1: Deny without MFA**

```bash
# Attempt AWS API call without MFA token
aws s3 ls --profile <iam-user>
# Expected: AccessDenied error
# Output: "User: arn:aws:iam::...:user/... is not authorized to perform: 
#          s3:ListBucket because no allow policy was found"
```

**Test 2: Succeed with MFA Token**

```bash
# Get MFA device ARN
MFA_ARN=$(aws iam list-mfa-devices --user-name <iam-user> \
  --query 'MFADevices[0].SerialNumber' --output text)

# Get temporary credentials with MFA
TEMP_CREDS=$(aws sts get-session-token \
  --serial-number $MFA_ARN \
  --token-code <6-digit-totp-code> \
  --query 'Credentials')

# Use temporary credentials for API call
export AWS_ACCESS_KEY_ID=$(echo $TEMP_CREDS | jq -r '.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $TEMP_CREDS | jq -r '.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $TEMP_CREDS | jq -r '.SessionToken')

aws s3 ls
# Expected: S3 listing returned successfully ✅
```

**Test 3: CloudWatch Monitoring**

```bash
# Query for MFA enforcement denials
aws logs filter-log-events \
  --log-group-name /aws/cloudtrail/kindswap \
  --filter-pattern "{ ($.errorCode = \"*UnauthorizedOperation\") || ($.errorCode = \"AccessDenied*\") }"
```

### Part 2 — Pritunl VPN MFA (Manual Configuration)

**Status:** Manual configuration required (cannot automate)

#### Prerequisites:

- Access to Pritunl admin panel
- Team member email addresses
- Authenticator app: Google Authenticator, Authy, or 1Password

#### Configuration Steps:

**Step 1: Enable TOTP in Pritunl Organization**

1. Log into Pritunl admin panel
2. Navigate to **Organization Settings**
3. Enable **Two-Factor Authentication (TOTP)** 
4. Select TOTP Standard: **RFC 6238**
5. Save settings

**Step 2: Add MFA Device to User Profile**

1. Navigate to **Users**
2. Select user → **Edit**
3. Under **Two-Factor Authentication:**
   - Enable TOTP
   - Click **Generate QR Code**
   - User scans QR code with Authenticator app
4. Save user profile

**Step 3: Test TOTP MFA on VPN Connection**

1. User opens Pritunl client
2. Enter VPN credentials (username/password)
3. System prompts for **TOTP Code**
4. User enters 6-digit code from Authenticator app
5. VPN connection established ✅

#### MFA Coverage Per SoW v5:

| Role | VPN MFA | Console MFA | Action |
|---|---|---|---|
| Admin/Founders | RFC 6238 TOTP | TOTP | Both enabled |
| DevOps Team | RFC 6238 TOTP | TOTP | Both enabled |
| Backend Engineers | RFC 6238 TOTP | — | VPN only |
| Smart Contract Engineers | RFC 6238 TOTP | — | VPN only |

**Implementation Checklist:**

```
Pritunl VPN MFA Setup:
[ ] TOTP enabled in Organization settings (RFC 6238 standard)
[ ] Admin/Founders: TOTP configured
[ ] DevOps team members: TOTP configured
[ ] Backend engineers: TOTP configured
[ ] Smart contract engineers: TOTP configured
[ ] Test: User connects via VPN, prompted for TOTP ✅

AWS Console MFA Setup:
[ ] MFA enforcement policy deployed via Terraform
[ ] Attached to devops-team IAM group
[ ] All console users configured with virtual MFA device
[ ] Test: API call denied without MFA ✅
[ ] Test: API call succeeds with MFA token ✅
```

### Onboarding Guide — VPN with MFA

**Create at: `/docs/VPN_ONBOARDING_WITH_MFA.md`**

#### New Team Member Onboarding

**Step 1: Install Pritunl Client**

- **macOS:** `brew install pritunl`
- **Linux:** `apt install pritunl-client` (Ubuntu/Debian)
- **Windows:** Download from https://pritunl.com/download
- **iOS/Android:** Install from App Store / Play Store

**Step 2: Get VPN Profile**

1. Request VPN profile from DevOps team
2. Download `.ovpn` profile file
3. Store in safe location (not shared cloud storage)

**Step 3: Set Up MFA (TOTP)**

1. Install Authenticator app:
   - **iOS:** Google Authenticator / Authy / 1Password
   - **Android:** Google Authenticator / Authy / 1Password
2. Receive Pritunl QR code from DevOps team
3. Scan QR code in Authenticator app
4. Save backup codes in secure location
5. Confirm TOTP code with Pritunl admin

**Step 4: Connect to VPN**

**Option A: OpenVPN Protocol (Recommended)**

```bash
# Import profile
pritunl-client import-profile path/to/profile.ovpn

# Connect
pritunl-client connect <profile-name>

# Prompted for:
# - VPN Username
# - VPN Password
# - TOTP Code (from Authenticator app)

# Verify connection
curl https://ipinfo.io/ip
# Should show VPN exit IP
```

**Option B: WireGuard Protocol**

```bash
# Import WireGuard profile
wg-quick up path/to/profile.conf

# Connect
sudo wg-quick up <profile-name>

# Verify
wg show
```

**Step 5: Test VPN Access**

```bash
# Test that admin services are accessible (VPN-only)
curl https://admin-api.production.kindswap.world/health
# Should return 200

# Test that public services are accessible
curl https://kindswap.world/health
# Should return 200
```

**Step 6: Troubleshooting**

- **TOTP Code Rejected:** Ensure device time is synchronized
- **VPN Connection Refused:** Confirm profile is imported correctly
- **Cannot reach admin services:** Verify VPN connection is active

---

## End-of-Day Verification Checklist (S5 & S7)

### S5 — Rate Limiting

- [ ] **Layer 1 (Cloudflare):** Terraform deployed OR manual rule created
  - Path `/api/*` configured
  - Threshold 15 req/60s set
  - Rule status: **Active** in Cloudflare dashboard
- [ ] **Layer 2 (NestJS):** Code changes applied
  - Throttle limit: 15 requests/min ✅
  - @SkipThrottle on health endpoint ✅
  - Global ThrottlerGuard registered ✅
- [ ] **Layer 1 Test:** Burst requests → HTTP 429 at Cloudflare edge
- [ ] **Layer 2 Test:** 16 rapid requests → 16th returns HTTP 429
- [ ] **CloudWatch Alarm:** 429 response rate monitored

### S7 — MFA Enforcement

- [ ] **AWS Console MFA:** Terraform policy deployed ✅
  - Policy ARN: noted
  - Attached to IAM users/groups
  - Test: API denied without MFA ✅
  - Test: API succeeds with MFA token ✅
- [ ] **Pritunl VPN MFA:** Manual configuration
  - TOTP enabled in Organization
  - All users configured with TOTP
  - Test: VPN prompt requests TOTP code ✅
- [ ] **MFA Coverage:** Verify per role
  - Admin/Founders: Both VPN + Console
  - DevOps: Both VPN + Console
  - Engineers: VPN only
- [ ] **Onboarding Guide:** Created and distributed

---

## Deployment Timeline

**Estimated Duration: 2 hours**

| Task | Duration | Dependencies |
|---|---|---|
| Deploy Cloudflare rate limiting (Terraform) | 5 min | API token, Zone ID |
| Deploy AWS MFA policy (Terraform) | 5 min | None |
| Attach MFA policy to users | 10 min | IAM console access |
| Configure Pritunl VPN MFA | 20 min | Pritunl admin access |
| Add TOTP to all users | 30 min | Per-user setup |
| Test Layer 1 rate limiting | 10 min | VPN access |
| Test Layer 2 rate limiting | 10 min | Backend access |
| Test AWS Console MFA | 10 min | IAM credentials |
| Test Pritunl VPN MFA | 10 min | VPN client |
| Create onboarding guide | 5 min | Documentation |
| Verify CloudWatch alarms | 5 min | Console access |
| **TOTAL** | **~2 hours** | — |

---

## Rollback Procedures

### S5 — Rate Limiting Rollback

**Cloudflare Edge Disabled:**
```bash
terraform destroy -target=cloudflare_rate_limit.api_rate_limit
```

**NestJS Rollback (if needed):**
```bash
# Revert to limit: 100, remove @SkipThrottle
git revert <commit-hash>
docker build && helm upgrade kindswap-backend
```

### S7 — MFA Enforcement Rollback

**AWS Console MFA Disabled:**
```bash
terraform destroy -target=aws_iam_policy.mfa_enforcement
terraform destroy -target=aws_iam_group.devops_team
```

**Pritunl VPN MFA Disabled:**
1. Navigate to Pritunl Organization settings
2. Disable TOTP requirement
3. Notify users

---

**Status: Ready for Implementation**

All configurations are prepared and ready for deployment. Estimated timeline: 2 hours for full implementation including testing.

Contact DevOps team for questions or issues during implementation.
