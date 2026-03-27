# Production Backend Deployment - Remediation Plan

**Execution Date:** March 27, 2026  
**Objective:** Fix all blocking issues and redeploy production backend & admin-backend

---

## Root Cause Analysis

### Primary Issues (Blocking)

1. **Service Accounts Not Created**
   - Helm releases were atomically deleted after failed deployments
   - Service accounts (kindswap-backend, kindswap-admin-backend) were deleted
   - New deployments need these service accounts to reference IRSA roles

2. **Secrets Manager Access Failure (Network Path)**
   - CSI driver initially wasn't available in pod's request context
   - After driver became available, pods fail to fetch secrets from Secrets Manager
   - Error: "Failed to fetch secret from all regions"
   - Indicates: Karpenter nodes cannot reach `secretsmanager.us-east-1.amazonaws.com`

3. **Missing TLS Certificate**
   - ALB controller cannot configure ingress without certificate
   - Blocks ingress resource deployment

4. **ALB Controller IAM Permissions**
   - Missing `elasticloadbalancing:ModifyLoadBalancerAttributes`
   - Prevents ALB from being fully configured

---

## Execution Plan

### PHASE 1: Verify Prerequisites

**Step 1.1 - Verify Secrets Manager Secret**
```bash
aws secretsmanager get-secret-value \
  --secret-id kindswap/db/prod/credentials \
  --region us-east-1
# Expected: Returns secret with db connection details
```

**Step 1.2 - Verify IRSA Roles Exist**
```bash
aws iam get-role --role-name kindswap-backend-production
aws iam get-role --role-name kindswap-admin-backend-production
# Expected: Both roles exist
```

**Step 1.3 - Verify IAM Policies Allow Secrets Access**
```bash
aws iam list-attached-role-policies \
  --role-name kindswap-backend-production
# Expected: Policy attached that allows secretsmanager:GetSecretValue
```

---

### PHASE 2: Fix Network Access (Karpenter → Secrets Manager)

**HYPOTHESIS:** Karpenter nodes in private subnets cannot reach Secrets Manager endpoint

**Root Cause Investigation:**
- Core nodes (ON_DEMAND) may have NAT gateway in different AZ
- Karpenter nodes (SPOT) may be in AZ without NAT gateway
- Need to verify routing table configuration

**Step 2.1 - Check Karpenter Node Subnets**
```bash
# Get instance IDs of Karpenter nodes
aws ec2 describe-instances \
  --filters "Name=tag:karpenter.sh/nodepool,Values=default" \
  --query 'Reservations[].Instances[].{InstanceId:InstanceId,SubnetId:SubnetId,AZ:Placement.AvailabilityZone}' \
  --region us-east-1
```

**Step 2.2 - Check Routing Configuration**
```bash
# Get NAT gateway configuration for each subnet
aws ec2 describe-nat-gateways \
  --filter "Name=tag-key,Values=karpenter.sh/nodepool" \
  --region us-east-1

# Check route tables for Karpenter subnets
aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=<karpenter-subnet-id>" \
  --region us-east-1
```

**Step 2.3 - Possible Solutions**

Option A: Use VPC Endpoint for Secrets Manager
```bash
# Create VPC endpoint so pods don't need NAT gateway
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids <private-subnet-ids> \
  --security-group-ids <security-group-id>
```

Option B: Ensure All Subnets Have NAT Gateway
```bash
# Verify all Karpenter node subnets have NAT gateway route
# If missing, create NAT gateway in AZ where Karpenter nodes are deployed
```

**Step 2.4 - Test Connectivity**
```bash
# Deploy test pod on Karpenter node
kubectl run debug-karpenter --image=curlimages/curl \
  --nodeSelector="karpenter.sh/nodepool=default" \
  -it -n production -- \
  curl -I https://secretsmanager.us-east-1.amazonaws.com

# Should return: HTTP/1.1 200 OK (or similar, not connection timeout)
```

---

### PHASE 3: Fix Certificate Issues

**Step 3.1 - Check if ACM Certificate Exists**
```bash
aws acm list-certificates --region us-east-1 | grep kindswap.world
```

**Step 3.2 - Create Certificate if Missing**
```bash
aws acm request-certificate \
  --domain-name kindswap.world \
  --domain-name "*.kindswap.world" \
  --validation-method DNS \
  --region us-east-1
# Note: Requires DNS validation (add CNAME record to DNS provider)
```

**Step 3.3 - Update Helm Values with Certificate ARN**
```bash
# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='kindswap.world'].CertificateArn" \
  --output text)

# Update backend helm values
# infra/infra/infra-k8s/05-apps/helm/kindswap-backend/values.yaml
# Add: certArn: <certificate-arn>

# Update admin-backend helm values  
# infra/infra/infra-k8s/05-apps/helm/kindswap-admin-backend/values.yaml
# Add: certArn: <certificate-arn>
```

---

### PHASE 4: Fix ALB Controller Permissions

**Step 4.1 - Identify ALB Controller IRSA Role**
```bash
kubectl describe sa alb-controller -n kube-system | grep role-arn
# Extract role name from annotation
```

**Step 4.2 - Add Missing Permission**
```bash
# Create inline policy or update existing policy to include:
aws iam put-role-policy \
  --role-name <alb-controller-role> \
  --policy-name ALBControllerInlinePolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "elasticloadbalancing:ModifyLoadBalancerAttributes"
        ],
        "Resource": "*"
      }
    ]
  }'
```

---

### PHASE 5: Redeploy Backend Services

**Step 5.1 - Prepare Helm Charts**
```bash
# Ensure backend/admin-backend Helm charts are correct
# Update values.yaml with:
# - serviceAccount.create: true
# - serviceAccount.name: kindswap-backend (or kindswap-admin-backend)
# - certArn: <certificate-arn>
```

**Step 5.2 - Deploy Backend**
```bash
helm upgrade --install kindswap-backend \
  ./infra/infra/infra-k8s/05-apps/helm/kindswap-backend \
  --namespace production \
  --timeout 15m \
  --wait \
  --atomic
```

**Step 5.3 - Deploy Admin Backend**
```bash
helm upgrade --install kindswap-admin-backend \
  ./infra/infra/infra-k8s/05-apps/helm/kindswap-admin-backend \
  --namespace production \
  --timeout 15m \
  --wait \
  --atomic
```

**Step 5.4 - Monitor Pod Startup**
```bash
# Watch pods come up
kubectl get pods -n production -w

# Check pod logs if stuck
kubectl logs -n production kindswap-backend-<pod-hash> --all-containers=true -f

# Describe pod to see events
kubectl describe pod -n production kindswap-backend-<pod-hash>
```

---

### PHASE 6: Validate Deployment

**Step 6.1 - Verify Pods Running**
```bash
kubectl get pods -n production -o wide
# Expected: All 5 pods Running (2x frontend, 2x admin-frontend, 1x backend)
```

**Step 6.2 - Check Database Connectivity**
```bash
# Port forward to backend
kubectl port-forward -n production svc/kindswap-backend 3000:3000 &

# Test health endpoint
curl http://localhost:3000/health

# Check if database migrations ran
aws rds describe-db-instances \
  --db-instance-identifier kindswap-prod \
  --query 'DBInstances[0].DBInstanceStatus'
# Should be: available
```

**Step 6.3 - Verify Ingress Deployment**
```bash
kubectl get ingress -n production
# All ingress resources should be deployed with proper ALB

kubectl describe ingress kindswap-backend -n production
# Should show backend ALB with certificate
```

**Step 6.4 - Test Endpoints**
```bash
# Get ALB DNS name from ingress
ALB_DNS=$(kubectl get ingress kindswap-backend -n production \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test HTTPS
curl https://$ALB_DNS/health -k
# Should return 200 with health status
```

---

## Rollback Plan

If Phase 5 deployments fail:

```bash
# Delete failed releases
helm uninstall kindswap-backend -n production
helm uninstall kindswap-admin-backend -n production

# Review error logs
kubectl get events -n production --sort-by='.lastTimestamp' | tail -30

# Identify remaining issue
# Return to appropriate phase above and fix
```

---

## Success Criteria

✅ All 5 production pods Running (2/2 frontend, 2/2 admin-frontend, 1/1 backend)  
✅ Backend pods have mounted secrets-store volume  
✅ Database migrations executed on production RDS  
✅ Ingress resources deployed with valid certificate  
✅ Health endpoint responding at `https://kindswap.world/health`  
✅ Admin backend responding at `https://kindswap.world/admin/health`  
✅ No pod errors or pending states  

---

## Commands Summary (Quick Reference)

```bash
# 1. Verify prerequisites
aws secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials --region us-east-1

# 2. Test Karpenter node connectivity
kubectl run debug --image=curlimages/curl --nodeSelector="karpenter.sh/nodepool=default" \
  -it -n production -- curl -I https://secretsmanager.us-east-1.amazonaws.com

# 3. Get certificate ARN
aws acm list-certificates --region us-east-1 | grep kindswap.world

# 4. Redeploy backends
helm upgrade --install kindswap-backend ./infra/infra/infra-k8s/05-apps/helm/kindswap-backend \
  --namespace production --timeout 15m --wait --atomic

helm upgrade --install kindswap-admin-backend ./infra/infra/infra-k8s/05-apps/helm/kindswap-admin-backend \
  --namespace production --timeout 15m --wait --atomic

# 5. Monitor
kubectl get pods -n production -w
kubectl logs -n production kindswap-backend-<pod> --all-containers=true -f
```

---

## Notes

- All failures occurred because pods couldn't mount CSI secrets-store volume
- Initially CSI driver wasn't available to the pod scheduler
- After driver became available, Secrets Manager access failed
- Likely network issue (NAT gateway routing for Karpenter nodes)
- Once network fixed, redeployment should succeed
- Database migrations will run automatically on pod startup

