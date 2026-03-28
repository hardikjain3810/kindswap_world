# CONNECTIVITY & DATA STREAMING VERIFICATION GUIDE

**Objective:** Verify all networking, routing, and data flow after S1-S8 deployment  
**Date:** March 28, 2026  
**Target:** us-east-1 region ONLY  
**Scope:** All 4 services across all 3 environments

---

## TEST SUITE 1: POD-TO-POD COMMUNICATION

### Test 1.1: Backend → Database Connection

**Purpose:** Verify backend can connect to RDS database  
**Expected Result:** Connection succeeds, credentials work

```bash
# Get backend pod name
POD=$(kubectl get pods -n production -l app=kindswap-backend -o name | head -1)
echo "Testing pod: $POD"

# Check if pod has database connectivity
kubectl exec -it $POD -n production -- bash -c 'echo "SELECT 1;" | psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME'

# Expected output:
# ?column?
#    1
```

**If fails:**
- [ ] Check database credentials in Secrets Manager: `aws secretsmanager get-secret-value --secret-id kindswap/db/prod/credentials`
- [ ] Verify RDS endpoint is reachable: `kubectl run test-pod --image=ubuntu --rm -it -- apt-get update && apt-get install -y postgresql-client && psql -h <RDS-ENDPOINT> -U postgres -d kindswap`
- [ ] Check security group allows port 5432 from EKS cluster

### Test 1.2: Frontend → Backend API

**Purpose:** Verify frontend can reach backend service  
**Expected Result:** API returns 200 OK

```bash
# Get frontend pod
FRONTEND=$(kubectl get pods -n production -l app=kindswap-frontend -o name | head -1)

# Test API endpoint
kubectl exec -it $FRONTEND -n production -- curl -v http://kindswap-backend:3000/api/health

# Expected output:
# HTTP/1.1 200 OK
# {"status":"ok"}
```

**If fails:**
- [ ] Check backend service exists: `kubectl get svc kindswap-backend -n production`
- [ ] Verify backend pods are Running: `kubectl get pods -n production -l app=kindswap-backend`
- [ ] Check network policies aren't blocking: `kubectl get networkpolicies -n production`

### Test 1.3: Cross-Namespace Communication (Should be Blocked)

**Purpose:** Verify network policies isolate environments  
**Expected Result:** Dev cannot reach production

```bash
# Get dev pod
DEV_POD=$(kubectl get pods -n dev -l app=kindswap-backend -o name | head -1)

# Attempt to reach production backend
kubectl exec -it $DEV_POD -n dev -- curl -v http://kindswap-backend.production:3000/api/health

# Expected result: Connection timeout or refused (no response for 10+ seconds)
# Ctrl+C to exit

echo "Test completed - Dev → Prod communication blocked ✓"
```

**If succeeds (PROBLEM):**
- [ ] Network policies not applied properly
- [ ] Review production network policy: `kubectl get networkpolicy -n production -o yaml`
- [ ] Verify "default deny" policy exists

### Test 1.4: DNS Resolution

**Purpose:** Verify Kubernetes DNS working  
**Expected Result:** Service names resolve to cluster IPs

```bash
# Get pod to test from
POD=$(kubectl get pods -n production -l app=kindswap-frontend -o name | head -1)

# Resolve service names
kubectl exec -it $POD -n production -- nslookup kindswap-backend
kubectl exec -it $POD -n production -- nslookup kindswap-backend.production
kubectl exec -it $POD -n production -- nslookup kindswap-backend.production.svc.cluster.local

# Expected output: All three return cluster IP (172.x.x.x)
```

**If fails:**
- [ ] Check DNS pod: `kubectl get pods -n kube-system -l k8s-app=kube-dns`
- [ ] Review CoreDNS logs: `kubectl logs -n kube-system -l k8s-app=kube-dns`

---

## TEST SUITE 2: INGRESS & ALB ROUTING

### Test 2.1: HTTP Redirect to HTTPS

**Purpose:** Verify all HTTP traffic redirects to HTTPS  
**Expected Result:** HTTP requests return 301/302 with Location: https://

```bash
# Test from outside cluster (requires internet)
curl -v http://kindswap.world/api/health

# Expected output:
# HTTP/1.1 301 Moved Permanently
# Location: https://kindswap.world/api/health

# Follow redirect
curl -L https://kindswap.world/api/health

# Expected output:
# HTTP/1.1 200 OK
# {"status":"ok"}
```

### Test 2.2: Host-Based Routing (Production - Public)

**Purpose:** Verify kindswap.world routes to production pods  
**Expected Result:** Returns production data

```bash
# From internet (no VPN required)
curl https://kindswap.world/api/health -H "X-Forwarded-For: 1.2.3.4"

# Expected: 200 OK
# Verify response comes from production backend
curl https://kindswap.world/api/health | grep -i environment
```

### Test 2.3: Host-Based Routing (Staging - VPN Only)

**Purpose:** Verify staging only accessible from VPN  
**Expected Result:** Non-VPN access blocked

```bash
# FROM OUTSIDE VPN (without VPN connected)
curl -v https://stg.kindswap.world/api/health

# Expected: 403 Forbidden or connection timeout
# Error: "Access denied" or no response after 10 seconds

# FROM INSIDE VPN (after connecting)
curl -v https://stg.kindswap.world/api/health

# Expected: 200 OK
# {"status":"ok","environment":"staging"}
```

**If non-VPN gets 200 (SECURITY ISSUE):**
- [ ] Check ALB listener rules: `aws elbv2 describe-rules --listener-arn <LISTENER_ARN>`
- [ ] Verify VPN CIDR whitelist applied
- [ ] Review security groups

### Test 2.4: Admin Panel - VPN Only

**Purpose:** Verify master.kindswap.world only accessible from VPN  
**Expected Result:** Blocked outside VPN

```bash
# FROM OUTSIDE VPN
curl -v https://master.kindswap.world

# Expected: 403 or timeout

# FROM INSIDE VPN
curl -v https://master.kindswap.world

# Expected: 200 or login redirect
```

### Test 2.5: HTTPS Certificate Valid

**Purpose:** Verify SSL certificate is valid for all domains  
**Expected Result:** No certificate warnings

```bash
# Check certificate
openssl s_client -connect kindswap.world:443 -showcerts

# Verify:
# ✓ Certificate is valid (dates OK)
# ✓ CN matches kindswap.world
# ✓ SANs include: stg.kindswap.world, dev.kindswap.world, master.kindswap.world
# ✓ Issuer: Amazon (ACM)
```

---

## TEST SUITE 3: DATA STREAMING & METRICS

### Test 3.1: Backend API Returns Real Data

**Purpose:** Verify backend can query database and return data  
**Expected Result:** Non-empty API response

```bash
# From VPN, test main API endpoint
curl https://kindswap.world/api/users \
  -H "Authorization: Bearer <TOKEN>"

# Expected: 200 OK with user data
# {
#   "users": [...],
#   "count": X,
#   "timestamp": "2026-03-28T..."
# }
```

**If empty response or error:**
- [ ] Check database schema: `kubectl exec $POD -- psql -c "\dt"`
- [ ] Check backend logs: `kubectl logs -n production kindswap-backend-xxx`
- [ ] Verify database credentials working (Test 1.1)

### Test 3.2: Metrics Flowing to Monitoring

**Purpose:** Verify Prometheus scrapes metrics from backend  
**Expected Result:** Metrics appear in Prometheus

```bash
# Check Prometheus targets
kubectl port-forward -n kube-system svc/prometheus 9090:9090

# Navigate to http://localhost:9090/targets
# Look for: kindswap-backend endpoints with status "UP"

# Query metric
curl http://localhost:9090/api/v1/query?query=container_cpu_usage_seconds_total

# Expected: Non-empty response with metric data
```

### Test 3.3: Logs Flowing to CloudWatch

**Purpose:** Verify backend logs appear in CloudWatch  
**Expected Result:** Recent logs visible

```bash
# Check CloudWatch logs
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `kindswap`) || contains(logGroupName, `backend`)]'

# Query recent logs
aws logs tail /aws/eks/kindswap-prod/backend --follow --since 1m

# Expected: Recent log entries from backend pods
# [2026-03-28T12:00:00Z] INFO: Server listening on port 3000
# [2026-03-28T12:00:05Z] INFO: Database connected
```

**If logs not appearing:**
- [ ] Verify pod logging configured
- [ ] Check CloudWatch log group exists: `aws logs describe-log-groups`
- [ ] Verify pod has CloudWatch agent sidecar

### Test 3.4: Rate Limiting Active

**Purpose:** Verify rate limiting responses after threshold  
**Expected Result:** 429 Too Many Requests after 15 requests/minute

```bash
# Send 20 requests in rapid succession
for i in {1..20}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://kindswap.world/api/health)
  echo "Request $i: HTTP $HTTP_CODE"
done

# Expected output:
# Request 1-15: HTTP 200
# Request 16-20: HTTP 429 (Too Many Requests)
```

**Verify Retry-After header:**

```bash
curl -v https://kindswap.world/api/health
# Expected response headers:
# < HTTP/1.1 429 Too Many Requests
# < Retry-After: 60
```

**If 429 not appearing:**
- [ ] Check NestJS ThrottlerModule configured
- [ ] Verify rate limiting rule deployed: `kubectl get configmap -n production | grep rate`
- [ ] Check CloudFlare rule active

### Test 3.5: Secret Mounts Accessible

**Purpose:** Verify pods can read mounted secrets  
**Expected Result:** Secret files exist and contain data

```bash
# Get backend pod
POD=$(kubectl get pods -n production -l app=kindswap-backend -o name | head -1)

# Check secret mount
kubectl exec -it $POD -n production -- ls -la /mnt/secrets/

# Expected output:
# drwxrwxrwt  2 root root 4096 Mar 28 12:00 ./
# drwxr-xr-x  3 root root 4096 Mar 28 12:00 ../
# -rw-r--r--  1 root root  100 Mar 28 12:00 credentials
# -rw-r--r--  1 root root   50 Mar 28 12:00 helius
# -rw-r--r--  1 root root   80 Mar 28 12:00 sentry

# Verify contents
kubectl exec -it $POD -n production -- cat /mnt/secrets/credentials
# Expected: username=postgres password=xxx host=kindswap-prod.xxx

# Check refresh timestamp
kubectl exec -it $POD -n production -- stat /mnt/secrets/credentials | grep Modify
# Recent timestamp shows CSI driver is refreshing
```

---

## TEST SUITE 4: CROSS-ENVIRONMENT VERIFICATION

### Test 4.1: Dev Environment (Fixed 1 Pod)

```bash
# Verify dev backend has 1 pod (not HPA)
kubectl get deployment kindswap-backend -n dev -o wide
# Expected: DESIRED=1, READY=1

# Verify no HPA
kubectl get hpa -n dev
# Expected: No HPA for backend (or shows fixed replicas)
```

### Test 4.2: Staging Environment (HPA 1-3)

```bash
# Verify staging HPA
kubectl get hpa kindswap-backend -n staging -o wide
# Expected: MINPODS=1, MAXPODS=3

# Current replicas should match HPA min
kubectl get deployment kindswap-backend -n staging -o wide
# Expected: READY >= 1, READY <= 3
```

### Test 4.3: Production Environment (HPA 2-10)

```bash
# Verify production HPA
kubectl get hpa kindswap-backend -n production -o wide
# Expected: MINPODS=2, MAXPODS=10

# Verify both replicas running
kubectl get deployment kindswap-backend -n production -o wide
# Expected: READY=2, AVAILABLE=2
```

---

## TEST SUITE 5: VPN ACCESS CONTROL

### Test 5.1: VPN CIDR Whitelist

**Prerequisite:** Pritunl VPN connecting users to CIDR range (e.g., 10.50.0.0/16)

```bash
# Get ALB listener rule for staging
aws elbv2 describe-rules \
  --listener-arn arn:aws:elasticloadbalancing:us-east-1:916994818641:listener/app/kindswap/xxx/xxx

# Look for rule with:
# PathPattern: /
# HostHeader: stg.kindswap.world
# SourceIp: 10.50.0.0/16

# Test 1: Outside VPN
curl https://stg.kindswap.world
# Expected: 403 Forbidden

# Test 2: Inside VPN
# (After VPN connection established)
curl https://stg.kindswap.world
# Expected: 200 OK
```

### Test 5.2: MFA Enforcement for Staging Access

**Purpose:** Verify MFA token required for VPN access to staging  
**Expected Result:** Cannot connect without TOTP code

```bash
# Test without MFA
# (Edit VPN profile to remove TOTP, or use backup code)
openvpn --config kindswap.ovpn

# Expected: Connection rejected after 30 seconds
# Error: "MFA code invalid" or "Authentication failed"

# Test with MFA
# (Provide valid 6-digit TOTP code)
openvpn --config kindswap.ovpn
# Prompted: Enter MFA Code:
# Input: 123456 (6-digit code from authenticator)

# Expected: Connection succeeds
# Status: Connected
```

---

## CHECKLIST FOR SIGN-OFF

### Infrastructure Connectivity
- [ ] Pod → Pod communication working (Test 1.1)
- [ ] Frontend → Backend API working (Test 1.2)
- [ ] Cross-namespace isolation enforced (Test 1.3)
- [ ] DNS resolution working (Test 1.4)

### Ingress & Routing
- [ ] HTTP → HTTPS redirect working (Test 2.1)
- [ ] Production public access working (Test 2.2)
- [ ] Staging VPN-only enforcement working (Test 2.3)
- [ ] Admin panel VPN-only enforcement working (Test 2.4)
- [ ] HTTPS certificate valid for all domains (Test 2.5)

### Data Streaming
- [ ] Backend API returns real data (Test 3.1)
- [ ] Metrics flowing to monitoring (Test 3.2)
- [ ] Logs flowing to CloudWatch (Test 3.3)
- [ ] Rate limiting responds with 429 (Test 3.4)
- [ ] Secret mounts accessible to pods (Test 3.5)

### Environment Configuration
- [ ] Dev: Fixed 1 pod (no HPA) (Test 4.1)
- [ ] Staging: HPA 1-3 replicas (Test 4.2)
- [ ] Production: HPA 2-10 replicas (Test 4.3)

### VPN & Security
- [ ] VPN CIDR whitelist enforced (Test 5.1)
- [ ] MFA required for VPN (Test 5.2)

---

## TROUBLESHOOTING FAILURES

### If Test Fails: "Connection refused"

**Causes:**
1. Service not running
2. Port not exposed
3. Firewall blocking

**Resolution:**
```bash
# Check pod running
kubectl get pods -n production

# Check service exists
kubectl get svc -n production

# Check port exposed
kubectl get svc kindswap-backend -n production -o yaml | grep -A5 ports

# Check network policy not too restrictive
kubectl get networkpolicy -n production -o yaml
```

### If Test Fails: "Connection timeout"

**Causes:**
1. Network policy blocking
2. Security group blocking
3. Route not configured

**Resolution:**
```bash
# Check network policies
kubectl get networkpolicy -n production

# Check security group rules
aws ec2 describe-security-groups --filters "Name=group-name,Values=kindswap-*"

# Check EKS node routing
kubectl debug node/<NODE> -it --image=ubuntu

# Inside debug container
ip route
iptables -L -n
```

### If Test Fails: "502 Bad Gateway"

**Causes:**
1. Backend pod crashed
2. Backend not responding to ALB health checks
3. ALB target group unhealthy

**Resolution:**
```bash
# Check backend pod logs
kubectl logs -n production kindswap-backend-xxx

# Check ALB target group
aws elbv2 describe-target-health --target-group-arn arn:aws:...

# Check health check settings
aws elbv2 describe-target-groups --names kindswap-backend
```

---

*Last Updated: March 28, 2026*  
*Test Suite Version: 1.0*  
*Status: Ready for Execution*
