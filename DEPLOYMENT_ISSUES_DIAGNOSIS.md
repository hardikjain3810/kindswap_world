# Production Deployment Issues - Diagnosis & Resolution

**Date:** March 27, 2026  
**Status:** 🔴 CRITICAL - All backend deployments failing  
**Root Cause:** Multiple interconnected issues preventing pod startup

---

## Critical Issues Found

### 🔴 ISSUE #1: CSI Secrets-Store Driver Not Available
**Severity:** CRITICAL - Blocks pod startup  
**Error:**
```
MountVolume.SetUp failed for volume "secrets-store": kubernetes.io/csi: 
mounter.SetUpAt failed to get CSI client: driver name secrets-store.csi.k8s.io 
not found in the list of registered CSI drivers
```

**Impact:**
- All backend pods fail at volume mount stage
- Pods stuck in Pending state indefinitely
- Helm deployment times out after 10 minutes and rolls back atomically

**Root Cause:** 
- Secrets Store CSI Driver not deployed to production namespace
- Or CSI driver pod not running/ready

**Action Required:**
1. Verify CSI driver is installed: `helm list -n kube-system | grep csi`
2. Check CSI driver pods: `kubectl get pods -n kube-system -l app=secrets-store-csi-driver`
3. If missing, install: Secrets Store CSI Driver Helm chart
4. Verify it's available in production: `kubectl get csidrivers`

---

### 🔴 ISSUE #2: AWS Secrets Manager Access Failure
**Severity:** CRITICAL - Blocks pod startup (after CSI driver available)  
**Error:**
```
MountVolume.SetUp failed for volume "secrets-store": rpc error: code = Unknown desc = 
failed to mount secrets store objects for pod production/kindswap-backend-5c69556f86-76tsf, 
err: rpc error: code = Unknown desc = Failed to fetch secret from all regions: kindswap/db/prod/credentials
```

**Impact:**
- Even if CSI driver is available, pods cannot fetch secrets
- Pods stuck at secret retrieval stage
- Blocks backend startup (database credentials stored in Secrets Manager)

**Root Causes:**
1. **IRSA Role/Policy Issue:** The pod's service account IRSA role may lack permissions to access Secrets Manager
2. **Secret Not Found:** Secret `kindswap/db/prod/credentials` doesn't exist in Secrets Manager
3. **Network Access:** Karpenter nodes cannot reach Secrets Manager endpoint (VPC/network issue)
4. **Region Mismatch:** Secret exists in different region than expected

**Action Required:**
1. **Verify secret exists:**
   ```bash
   aws secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials --region us-east-1
   ```

2. **Check IRSA role permissions:**
   ```bash
   # Get the IAM role ARN from service account
   kubectl describe sa kindswap-backend -n production
   
   # Verify policy allows secretsmanager:GetSecretValue
   aws iam get-role-policy --role-name <role-name> --policy-name <policy-name>
   ```

3. **Test pod access to Secrets Manager:**
   - Deploy debug pod on core node (working) and Karpenter node (failing)
   - Compare `curl https://secretsmanager.us-east-1.amazonaws.com` from each
   - Check security groups, NACLs, route tables

4. **Possible Network Fix:**
   - Core nodes may use different NAT gateway
   - Karpenter nodes may lack outbound access to Secrets Manager endpoint
   - May need VPC endpoint for Secrets Manager

---

### 🟡 ISSUE #3: ServiceAccount Mismatch for admin-backend
**Severity:** HIGH - Blocks admin-backend deployment  
**Error:**
```
Error creating: pods "kindswap-admin-backend-b78d9bd48-" is forbidden: 
error looking up service account production/kindswap-backend: serviceaccount "kindswap-backend" not found
```

**Impact:**
- admin-backend deployment cannot create pods
- Pod creation fails immediately with "forbidden" error

**Root Cause:**
- admin-backend deployment references service account `kindswap-backend` (which doesn't exist)
- Should reference `kindswap-admin-backend` instead

**Action Required:**
```bash
# Check existing service accounts
kubectl get sa -n production

# Verify admin-backend deployment references correct SA
kubectl get deployment kindswap-admin-backend -n production -o yaml | grep serviceAccountName

# Fix: Update Helm values to use correct service account
# File: infra/infra/infra-k8s/05-apps/helm/kindswap-admin-backend/values.yaml
```

---

### 🟡 ISSUE #4: ALB Controller Missing Permissions
**Severity:** HIGH - Blocks ingress creation  
**Error:**
```
Failed deploy model due to AccessDenied: User: arn:aws:sts::916994818641:assumed-role/kindswap-alb-controller-irsa/... 
is not authorized to perform: elasticloadbalancing:ModifyLoadBalancerAttributes
```

**Impact:**
- Ingress resources cannot be fully deployed
- Load balancer attributes not configured
- Affects all frontend and backend ingress resources

**Action Required:**
1. Update ALB Controller IAM policy to include `elasticloadbalancing:ModifyLoadBalancerAttributes`
2. Attach policy to ALB controller IRSA role

---

### 🟡 ISSUE #5: Missing TLS Certificate
**Severity:** MEDIUM - Frontend access issue  
**Error:**
```
Failed build model due to ingress: production/kindswap-backend: 
no certificate found for host: kindswap.world
```

**Impact:**
- HTTPS not configured for ingress
- Affects both frontend and backend ingress resources

**Action Required:**
1. Request/create ACM certificate for `kindswap.world`
2. Add certificate ARN to ingress annotation: `alb.ingress.kubernetes.io/certificate-arn`
3. Update Helm values with certificate ARN

---

### 🟡 ISSUE #6: HPA Cannot Get Metrics
**Severity:** MEDIUM - Auto-scaling blocked  
**Error:**
```
FailedComputeMetricsReplicas: invalid metrics (1 invalid out of 1), 
failed to get cpu resource metric value: unable to get metrics for resource cpu: 
no metrics returned from resource metrics API
```

**Impact:**
- HPA cannot scale pods
- Manual scaling only (if HPA is enabled)

**Action Required:**
1. Verify metrics-server is running: `kubectl get deployment metrics-server -n kube-system`
2. Check if pods are instrumented with resource requests/limits
3. Wait ~2-3 minutes after pod startup for metrics to appear

---

## Deployment Failure Timeline

**11m 15s ago:** Helm deployment started  
**First 2m:** Pods created, nominated for scheduling  
**2-10m:** Pods stuck in Pending state waiting for CSI driver  
**~5m remaining:** CSI driver eventually available, but Secrets Manager access fails  
**10m mark:** Helm timeout (context deadline exceeded)  
**10m 15s:** Atomic rollback triggered, all resources deleted

---

## Immediate Resolution Path

### STEP 1: Fix CSI Secrets-Store Driver (BLOCKING)
```bash
# Check if CSI driver is installed
kubectl get csidrivers

# If not present, install via Helm
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm install secrets-store-csi-driver secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system \
  --set syncSecret.enabled=true

# Verify pods are running
kubectl get pods -n kube-system | grep secrets-store-csi-driver

# Verify driver is registered
kubectl get csidrivers
```

### STEP 2: Fix AWS Secrets Manager Access (BLOCKING)
```bash
# Verify secret exists and is accessible
aws secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials --region us-east-1

# Check IRSA role has required permissions
kubectl describe sa kindswap-backend -n production
```

### STEP 3: Fix ServiceAccount Reference (BLOCKING)
```bash
# Create missing service account or fix deployment reference
# Update Helm values to reference correct service account
```

### STEP 4: Fix ALB Controller Permissions (MEDIUM)
```bash
# Update IAM policy attached to ALB controller IRSA role
# Add: elasticloadbalancing:ModifyLoadBalancerAttributes
```

### STEP 5: Add TLS Certificate (MEDIUM)
```bash
# Request ACM certificate or use existing one
# Update ingress annotations with certificate ARN
```

---

## Current Status Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Core Nodes | ✅ Working | N/A |
| Karpenter Nodes | ✅ Running | Cannot reach Secrets Manager |
| Production Frontends | ✅ 2/2 Running | Working properly |
| Production Backend | ❌ 0/1 Running | Pod won't start (Secrets access) |
| Production Admin Backend | ❌ 0/1 Running | Pod won't start (Secrets access + SA issue) |
| CSI Secrets-Store Driver | ❓ Unknown | May not be deployed |
| AWS Secrets Manager Access | ❌ Failing | Cannot fetch credentials |
| ALB Controller | ⚠️ Degraded | Missing IAM permissions |
| TLS Certificate | ⚠️ Missing | No cert for kindswap.world |
| Metrics (HPA) | ⚠️ Unavailable | Resource metrics not available |

---

## Next Steps

**Priority 1 (Blocking):**
1. Install/verify CSI Secrets-Store driver
2. Diagnose Secrets Manager access failure (network vs. IAM vs. secret not found)
3. Fix admin-backend service account reference

**Priority 2 (High):**
4. Update ALB controller IAM policy
5. Add TLS certificate for ingress

**Priority 3 (Medium):**
6. Configure metrics for HPA
7. Verify database connectivity once pods start
8. Monitor pod startup for any remaining issues

---

## Debugging Commands

```bash
# Check CSI driver status
kubectl get csidrivers
kubectl get pods -n kube-system -l app=secrets-store-csi-driver

# Check production pods/events
kubectl describe pod <pod-name> -n production
kubectl get events -n production --sort-by='.lastTimestamp'

# Check service accounts
kubectl get sa -n production -o yaml

# Check IRSA role annotations
kubectl describe sa kindswap-backend -n production

# Verify AWS credentials can be accessed from pod
kubectl run debug --image=amazon/aws-cli -it -n production -- \
  secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials --region us-east-1

# Check IAM policy
aws iam get-role-policy --role-name <kindswap-backend-role> --policy-name <policy-name>
```
