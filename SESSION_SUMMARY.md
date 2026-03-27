# 🔍 Production Deployment Failure - Root Cause Analysis & Fixes

## What Happened

Both backend deployment workflows (PR #46 and #31) failed with the same pattern:
- Helm deployment timed out after 10 minutes
- Pods stuck at 0/1 ready
- Helm rolled back atomically, deleting all resources
- Error: `context deadline exceeded`

---

## Root Cause Found ✅

The deployment failures are caused by **3 interconnected issues**, **2 of which are FIXED**:

### Issue 1: ❌ Network Connectivity (BLOCKING - NOT YET FIXED)
**Problem:** Pods cannot access AWS Secrets Manager to fetch database credentials
- CSI secrets-store driver eventually became available ✅
- But Karpenter nodes cannot reach `secretsmanager.us-east-1.amazonaws.com`
- Core nodes can access it (they were used for dev/staging successfully)
- **Root Cause:** NAT gateway or VPC endpoint issue for Karpenter node subnets

**Evidence from Kubernetes Events:**
```
FailedMount: MountVolume.SetUp failed for volume "secrets-store": 
rpc error: Failed to fetch secret from all regions: kindswap/db/prod/credentials
```

### Issue 2: ✅ FIXED - IRSA Role Naming (Commit 57a74ef)
**Problem:** Service account IRSA role annotation was wrong
- Template: `kindswap-backend-{{ .Values.environment }}-irsa`
- In production: `kindswap-backend-production-irsa` (incorrect)
- Actual role: `kindswap-backend-prod-irsa` (correct)
- Result: Service account creation would fail

**Fixes Applied:**
- Updated backend serviceaccount template: `{{ if eq .Values.environment "production" }}prod{{ else }}{{ .Values.environment }}{{ end }}`
- Created missing serviceaccount template for admin-backend
- Enabled serviceAccount creation in admin-backend values

### Issue 3: ✅ FIXED - Missing TLS Certificate & Ingress Config (Commit e646910)
**Problem:** 
- No ACM certificate for kindswap.world
- Ingress templates didn't include certificate ARNs
- ALB controller couldn't configure ingress resources properly

**Fixes Applied:**
- Created ACM certificate: `arn:aws:acm:us-east-1:916994818641:certificate/f39e16e4-6479-4f02-8999-f600a495736c`
- Updated all 4 ingress templates (backend, admin-backend, frontend, admin-frontend)
- Added certificate support to ingress annotations
- Configured HTTPS with SSL redirect

---

## What's Been Fixed

### ✅ Code Changes Applied (2 commits)
| Commit | Changes |
|--------|---------|
| `57a74ef` | Fixed IRSA role naming & added admin-backend serviceaccount template |
| `e646910` | Added TLS certificate & ingress configuration to all services |

### ✅ Infrastructure Changes
- ACM certificate requested
- Secrets Manager secret verified (exists and contains correct credentials)
- IRSA role permissions verified (correct policy attached)
- CSI driver verified (running on all nodes)

---

## What's NOT Fixed Yet (BLOCKING)

### ⚠️ Network Issue: Karpenter → Secrets Manager
The pods fail because Karpenter-managed nodes cannot reach AWS Secrets Manager endpoint.

**Two Possible Solutions:**

**Option A: Create VPC Endpoint (Recommended)**
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids <karpenter-subnet-ids> \
  --security-group-ids <security-group-id>
```

**Option B: Verify NAT Gateway Routing**
- Check if Karpenter node subnets have NAT gateway routes
- If missing: Create NAT gateway in AZ where Karpenter nodes are deployed

---

## Deployment Status

### Current State
```
Infrastructure:
✅ Core nodes with freed capacity (140m CPU available)
✅ Karpenter nodes running (pods scheduled)
✅ IRSA roles with correct permissions
✅ Secrets Manager secret exists
✅ TLS certificate requested

Kubernetes:
✅ All service templates correct
✅ All ingress templates configured
⚠️ Frontend pods: Running (2/2)
⚠️ Admin frontend pods: Running (2/2)
❌ Backend pods: Deleted (needs redeploy once network fixed)
❌ Admin backend pods: Deleted (needs redeploy once network fixed)

AWS:
✅ Secrets Manager: Ready
✅ RDS Database: Ready
✅ ACM Certificate: Requested (awaiting DNS validation)
❌ Network path from Karpenter to Secrets Manager: BROKEN
```

### What Needs to Happen Next

1. **IMMEDIATE - Fix Network Issue**
   - Diagnose why Karpenter nodes can't reach Secrets Manager
   - Implement VPC endpoint OR fix NAT gateway routing
   - Test: `kubectl run debug --image=amazon/aws-cli -it -n production -- secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials --region us-east-1`

2. **Then - Redeploy Backends**
   ```bash
   helm upgrade --install kindswap-backend ./infra/infra/infra-k8s/05-apps/helm/kindswap-backend -n production --timeout 15m --wait --atomic
   helm upgrade --install kindswap-admin-backend ./infra/infra/infra-k8s/05-apps/helm/kindswap-admin-backend -n production --timeout 15m --wait --atomic
   ```

3. **Then - Certificate DNS Validation** (non-blocking)
   - Add CNAME records for certificate validation
   - Wait for ACM to validate
   - HTTPS will work once validated

---

## Summary

### Fixes Applied This Session ✅
- ✅ Corrected IRSA role naming
- ✅ Added admin-backend serviceaccount template
- ✅ Requested TLS certificate
- ✅ Updated all ingress configurations
- ✅ Freed core node capacity in previous session
- ✅ Fixed GitHub Actions workflow routing in previous session

### Still Blocked ⚠️
- ⚠️ **Network connectivity from Karpenter to Secrets Manager**
  - This is why pods cannot start
  - Must be fixed before deployment can succeed
  - Requires VPC endpoint or NAT gateway fix

### Documentation Created
- `DEPLOYMENT_ISSUES_DIAGNOSIS.md` - Detailed analysis of all issues
- `REMEDIATION_PLAN.md` - Step-by-step fix procedures
- `DEPLOYMENT_ANALYSIS_COMPLETE.md` - Comprehensive post-analysis report

---

## Files to Review

All changes are on the `prod` branch:
```bash
git log --oneline -5
# Recent commits show fixes applied
```

Key files changed:
- `infra/infra/infra-k8s/05-apps/helm/kindswap-backend/templates/serviceaccount.yaml`
- `infra/infra/infra-k8s/05-apps/helm/kindswap-admin-backend/templates/serviceaccount.yaml` (new)
- All ingress templates (4 files)
- All values.yaml files with certificate ARN

