# ⚡ BULLET-POINT EXECUTION GUIDE: QUICK REFERENCE FOR DEVOPS

**Document Version:** v5  
**Date:** March 28, 2026  
**Audience:** DevOps Team, On-Call Engineers  

---

## 🚀 DEPLOYMENT FLOW: DEV → STAGING → PROD

### **Deploy to Development**

```bash
# Prerequisites
$ export GITHUB_TOKEN=xxxxx
$ git clone https://github.com/kindswap/kindswap.git
$ cd kindswap

# Build & Push to ECR
$ docker build -f backend/Dockerfile -t backend:dev-$(git rev-parse --short HEAD) .
$ aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 916994818641.dkr.ecr.us-east-1.amazonaws.com
$ docker tag backend:dev-abc1234 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev-abc1234
$ docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev-abc1234

# Deploy via Helm (dev namespace)
$ helm upgrade --install kindswap-backend ./helm/kindswap-backend \
    --namespace dev \
    --values ./helm/values-dev.yaml \
    --set image.tag=dev-abc1234 \
    --wait

# Verify
$ kubectl rollout status deployment/kindswap-backend -n dev
$ kubectl port-forward svc/kindswap-backend 3000:3000 -n dev
# Test: curl http://localhost:3000/health
```

### **Promote Dev → Staging**

```bash
# Same image, different namespace
$ helm upgrade --install kindswap-backend ./helm/kindswap-backend \
    --namespace staging \
    --values ./helm/values-staging.yaml \
    --set image.tag=dev-abc1234 \
    --wait

# Run integration tests
$ npm run test:e2e:staging

# Verify endpoints
$ curl -k https://staging.kindswap.world/api/v1/health
```

### **Promote Staging → Production**

```bash
# Create git tag (for traceability)
$ git tag -a v5.1.0 -m "Release v5.1.0: security audit complete"
$ git push origin v5.1.0

# Update prod values with new tag
$ helm upgrade --install kindswap-backend ./helm/kindswap-backend \
    --namespace production \
    --values ./helm/values-prod.yaml \
    --set image.tag=dev-abc1234 \
    --wait

# Verify
$ kubectl rollout status deployment/kindswap-backend -n production --timeout=10m
$ curl -k https://kindswap.world/api/v1/health
$ curl -k https://kindswap.world/api/v1/swap/quote -X POST -d '{...}'

# Check logs
$ kubectl logs -f deployment/kindswap-backend -n production --tail=50
```

---

## 🔄 ROLLBACK PROCEDURE (3 MINUTES)

### **Emergency Rollback**

```bash
# Option 1: Rollback to previous Helm release
$ helm history kindswap-backend -n production
# Output:
# REVISION STATUS  CHART  ...
# 10       DEPLOYED backend-1.0.0
# 9        SUPERSEDED backend-1.0.0

# Rollback to revision 9
$ helm rollback kindswap-backend 9 -n production --wait

# Verify new version is live
$ kubectl rollout status deployment/kindswap-backend -n production
$ curl https://kindswap.world/api/v1/health
```

### **Option 2: Scale Down New Version (Faster)**

```bash
# If rollback not working, scale down new pods
$ kubectl scale deployment/kindswap-backend --replicas=0 -n production
$ kubectl get pods -n production  # Confirm 0 replicas

# Scale up previous version (if blue-green deployed)
$ kubectl scale deployment/kindswap-backend-v4 --replicas=4 -n production

# Verify
$ kubectl get pods -n production
$ curl https://kindswap.world/api/v1/health
```

### **Option 3: Manual Pod Restart**

```bash
# Delete pods (forces restart with previous image)
$ kubectl delete pods -l app=kindswap-backend -n production

# Kubernetes automatically restarts them
$ kubectl get pods -n production

# Monitor logs
$ kubectl logs -f deployment/kindswap-backend -n production
```

**Timeline:** 30-60 seconds total (Kubernetes restart) + 30 seconds for health checks = ~2 minutes

---

## 🔐 MONITOR CREDENTIAL ROTATION LAMBDA

### **View Rotation Status**

```bash
# List recent rotations
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --query 'RotationRules' \
    --region us-east-1

# Output:
# {
#   "AutomaticallyAfterDays": 30,
#   "Duration": "3h",
#   "ScheduleExpression": "rate(30 days)"
# }

# Check last rotation result
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --query 'RotationStatus' \
    --region us-east-1
```

### **View Lambda Logs**

```bash
# Lambda logs in CloudWatch
$ aws logs tail /aws/lambda/rotate-db-password --follow

# Output:
# 2026-03-28T02:00:15Z [INFO] Starting rotation...
# 2026-03-28T02:00:25Z [INFO] Generated new password
# 2026-03-28T02:00:35Z [INFO] Updated RDS password
# 2026-03-28T02:00:45Z [INFO] Verified connection
# 2026-03-28T02:00:55Z [INFO] Rotation completed successfully
```

### **Force Manual Rotation (If Needed)**

```bash
# Invoke rotation immediately
$ aws secretsmanager rotate-secret \
    --secret-id kindswap/api/db-password \
    --rotation-rules AutomaticallyAfterDays=0 \
    --region us-east-1

# Monitor progress
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --query 'RotationStatus'
```

### **Troubleshoot Failed Rotation**

```bash
# If rotation failed:
$ aws logs filter-log-events \
    --log-group-name /aws/lambda/rotate-db-password \
    --start-time $(date -d '2 hours ago' +%s)000

# Common issues:
# 1. Lambda timeout (increase to 5 minutes in code)
# 2. Network error (check security group)
# 3. Database error (check RDS event logs)

# Manual override (if Lambda failed):
$ psql -h kindswap-prod.c*.us-east-1.rds.amazonaws.com \
    -U admin \
    -d kindswap_prod \
    -c "ALTER USER admin PASSWORD 'new_password_xyz';"

# Update Secrets Manager manually
$ aws secretsmanager update-secret \
    --secret-id kindswap/api/db-password \
    --secret-string 'new_password_xyz' \
    --region us-east-1
```

---

## 📊 CHECK CSI DRIVER REFRESH STATUS

### **External Secrets Operator (CSI Driver)**

```bash
# View ExternalSecret resources
$ kubectl get externalsecrets -A

# Check sync status
$ kubectl get externalsecrets \
    --namespace production \
    -o wide

# Output:
# NAME                                    STORE    KEY                           STATUS
# kindswap-backend-secrets                aws      kindswap/api/db-password      SecretSynced

# Check actual Kubernetes secret
$ kubectl get secret kindswap-backend-secrets -n production -o yaml

# Output:
# apiVersion: v1
# kind: Secret
# metadata:
#   name: kindswap-backend-secrets
# data:
#   db-host: <base64>
#   db-password: <base64>

# Decode to verify (WARNING: shows plaintext!)
$ kubectl get secret kindswap-backend-secrets -n production \
    -o jsonpath='{.data.db-password}' | base64 -d

# Check last sync time
$ kubectl describe externalsecret kindswap-backend-secrets -n production

# Output:
# Status:
#   Last Sync Time: 2026-03-28T13:45:30Z
#   Refresh Interval: 15m0s
```

### **Manual Refresh (Force Sync)**

```bash
# Delete ExternalSecret and recreate (forces resync)
$ kubectl delete externalsecret kindswap-backend-secrets -n production
$ kubectl apply -f helm/templates/externalsecret.yaml --namespace production

# Or reload pods to pick up new secret
$ kubectl rollout restart deployment/kindswap-backend -n production
```

---

## 🖥️ SCALE NODES MANUALLY (KARPENTER)

### **View Current Nodes**

```bash
# List all nodes
$ kubectl get nodes

# Output:
# NAME                          STATUS   ROLES    AGE   VERSION
# ip-10-0-20-40.ec2.internal   Ready    worker   2d    v1.28.0
# ip-10-0-20-50.ec2.internal   Ready    worker   2d    v1.28.0
# ip-10-0-20-60.ec2.internal   Ready    worker   5h    v1.28.0

# Check node capacity
$ kubectl top nodes

# Output:
# NAME                          CPU(cores)   MEMORY(Mi)
# ip-10-0-20-40.ec2.internal   150m         512Mi
# ip-10-0-20-50.ec2.internal   200m         768Mi
# ip-10-0-20-60.ec2.internal   1800m        7000Mi
```

### **Scale Up (Add More Nodes)**

```bash
# Karpenter auto-scales, but to force:
# Option 1: Create pod that requires more resources
$ kubectl create deployment resource-hog --image=busybox \
    -n production \
    --replicas=5 \
    --dry-run=client -o yaml | \
    sed 's/busybox.*/busybox/' | \
    kubectl apply -f -

# This will trigger Karpenter to provision new nodes

# Option 2: Manually patch NodePool (if needed)
$ kubectl patch nodeclaim <claim-id> -n karpenter \
    -p '{"spec":{"nodes":10}}' --type merge
```

### **Scale Down (Remove Idle Nodes)**

```bash
# Karpenter auto-consolidates, but to force:
$ kubectl delete node ip-10-0-20-50.ec2.internal \
    --ignore-daemongsets --delete-emptydir-data

# Karpenter will:
# 1. Drain pods from node
# 2. Reschedule pods to other nodes
# 3. Terminate EC2 instance
```

### **Check Karpenter Status**

```bash
# View NodePool
$ kubectl get nodepools -A

# View NodeClaims (pending nodes)
$ kubectl get nodeclaims -A

# View consolidation events
$ kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter --tail=50
```

---

## ✅ CHECK COSIGN SIGNATURES

### **Verify All Running Pods Have Valid Signatures**

```bash
# List all pods with their image
$ kubectl get pods -n production -o wide
$ kubectl get pods -n production \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# For each image, verify signature
$ cosign verify \
    --key kindswap-cosign.pub \
    916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:abc1234

# Output:
# Verification for 916994...abc1234
# The following checks were performed on each of these signatures:
#   - The cosign claims were appended to the image
#   - Existence of the claims in the transparency log was verified offline
#   - The code-signing certificate was verified using trusted certificate authority data
# [{"critical":{"identity":{"docker-reference":"..."},"image":{"docker-manifest-digest":"sha256:abc..."},"type":"cosignature"},"optional":{"Issuer":"github-actions","Subject":"https://github.com/kindswap/kindswap/.github/workflows/deploy-backend.yml"}}]
```

### **Check Admission Webhook Validation**

```bash
# Verify ValidatingWebhookConfiguration exists
$ kubectl get validatingwebhookconfigurations | grep cosign

# Check webhook rules
$ kubectl get validatingwebhookconfigurations cosign-signature-verification \
    -o yaml

# Test: Try to deploy unsigned image (will fail)
$ kubectl create deployment test-unsigned \
    --image=busybox:latest \
    -n production

# Expected error:
# Error from server (Forbidden): error when creating "deployment": admission webhook "verify.cosign.kindswap" denied the request
```

---

## 📈 REVIEW ECR SCAN RESULTS

### **View Latest Scan**

```bash
# List images with scan status
$ aws ecr describe-images \
    --repository-name kindswap-backend \
    --query 'imageDetails[?imageScanStatus.status==`COMPLETE`].[imageTags,imageScanStatus]'

# Output:
# [["v5.1.0"], {"status": "COMPLETE", "imageScanFindingsSummary": {"imageScanCompletedAt": ...}}]

# Get detailed findings
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=v5.1.0 \
    --query 'imageScanFindings'

# Output:
# {
#   "imageScanStatus": {"status": "COMPLETE"},
#   "findingSeverityCounts": {
#     "CRITICAL": 0,
#     "HIGH": 0,
#     "MEDIUM": 1,
#     "LOW": 2
#   },
#   "findings": [
#     {"severity": "MEDIUM", "name": "CVE-2022-3786", "uri": "https://nvd.nist.gov/..."}
#   ]
# }
```

### **Respond to Critical CVE**

```bash
# If CRITICAL found:
# 1. Immediately patch
$ cd backend
$ npm audit fix --force
$ docker build -t backend:hotfix-$(date +%s) .

# 2. Re-scan
$ docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:hotfix-xxx

# 3. Wait for ECR scan (5-10 minutes)
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=hotfix-xxx \
    --query 'imageScanFindings.findingSeverityCounts'

# 4. If fixed, deploy
$ helm upgrade --install kindswap-backend ... --set image.tag=hotfix-xxx
```

---

## 📋 SUMMARY: QUICK COMMANDS

```bash
# Deploy to production
helm upgrade --install kindswap-backend ./helm/kindswap-backend \
  --namespace production --values helm/values-prod.yaml --wait

# Rollback to previous
helm rollback kindswap-backend -n production --wait

# Check pod status
kubectl get pods -n production

# View logs
kubectl logs -f deployment/kindswap-backend -n production

# Scale pods
kubectl scale deployment/kindswap-backend --replicas=5 -n production

# Check node resources
kubectl top nodes

# Verify Cosign signature
cosign verify --key cosign.pub 916994.../backend:v5

# View ECR scan results
aws ecr describe-image-scan-findings --repository-name kindswap-backend \
  --image-id imageTag=v5

# Force credential rotation
aws secretsmanager rotate-secret --secret-id kindswap/api/db-password

# Check External Secret sync
kubectl get externalsecrets -n production

# Health check
curl https://kindswap.world/api/v1/health
```

---

**Document:** BULLET-POINT EXECUTION GUIDE  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
