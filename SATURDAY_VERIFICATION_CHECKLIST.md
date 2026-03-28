# SATURDAY EXECUTION PLAN v5 — DETAILED VERIFICATION REPORT
**Date:** March 28, 2026  
**Region:** us-east-1 only  
**Status:** VERIFICATION IN PROGRESS

---

## 📋 VERIFICATION CHECKLIST (S1-S8)

### S1 — IRSA Roles (IAM Roles for Service Accounts)

#### Requirements from Execution Plan:
- [ ] Extract OIDC issuer host from EKS outputs using regex replace local
- [ ] Create kindswap-eso-irsa-role with:
  - Trust: system:serviceaccount:external-secrets:externalsecrets
  - Permissions: secretsmanager:GetSecretValue/DescribeSecret/ListSecrets scoped to kindswap/*
  - KMS Decrypt on alias/kindswap-master
- [ ] Create kindswap-alb-controller-irsa-role with:
  - Trust: system:serviceaccount:kube-system:aws-loadbalancer-controller
  - Full ALB management permissions (EC2, elasticloadbalancing, IAM, Cognito, WAF, Shield, ACM)
- [ ] Create kindswap-backend-irsa-role with:
  - Trust: system:serviceaccount:production:kindswapbackend
  - Permissions: secretsmanager:GetSecretValue/DescribeSecret on kindswap/*
  - KMS Decrypt
- [ ] ALL trust policies use StringEquals (not StringLike)
- [ ] Verification: aws iam list-roles command lists all IRSA roles

**Current Status:** 
- Need to verify trust policies use StringEquals
- Need to check if backend role has correct trust policy

---

### S2 — Controllers

#### Requirements:
- [ ] AWS Load Balancer Controller v1.8.1
  - In kube-system namespace
  - ServiceAccount annotated with IRSA role ARN
  - replicaCount=2 for HA
  - Status: VERIFY NOW

- [ ] Metrics Server v3.12.1
  - In kube-system
  - kubectl top nodes returns CPU/memory
  - Status: APPEARS RUNNING - verify metrics work

- [ ] AWS Secrets Store CSI Driver
  - In kube-system
  - rotationPollInterval: 120s confirmed
  - Running on all nodes
  - Status: NEED TO VERIFY

- [ ] ClusterSecretStore: kindswap-aws-secret-store
  - Connects to AWS Secrets Manager
  - Uses ESO IRSA role
  - Helm provider auth uses exec-based (aws eks get-token)
  - Status: NEED TO VERIFY

---

### S3 — Kubernetes Namespaces, Network Policies & Secret Mounts

#### Requirements:
- [ ] 3 namespaces: production, staging, dev
  - With labels: environment=production/staging/dev
  - Status: VERIFIED (all 3 exist)

- [ ] Network Policies:
  - Production isolation: Deny all from dev/staging
  - Allow from production + kube-system
  - Default deny-all ingress on all 3 namespaces
  - Status: NEED TO VERIFY

- [ ] SecretProviderClass in each namespace:
  - Production: kindswap/db/prod/credentials + API keys, rotationPollInterval=120s
  - Staging: kindswap/db/staging/credentials, rotationPollInterval=120s
  - Dev: kindswap/db/dev/credentials, rotationPollInterval=120s
  - Status: NEED TO VERIFY

- [ ] ExternalSecret objects in each namespace
  - For API key secrets (Helius, Jupiter, CoinGecko, Sentry)
  - Via ClusterSecretStore
  - Status: NEED TO VERIFY

---

### S4 — Application Deployments

#### Requirements:
- [ ] kindswap-backend production:
  - Image from ECR with commit SHA tag
  - node:20-slim confirmed
  - ServiceAccount with kindswap-backend-irsa-role
  - HPA: minReplicas=2, maxReplicas=10, target CPU 70%
  - Resources: 250m CPU, 256Mi RAM
  - Status: PARTIALLY DONE - minReplicas=1 (NEEDS FIX from deployment earlier)

- [ ] kindswap-frontend production:
  - Nginx + Vite build image
  - 2+ pods with HPA
  - Status: APPEARS RUNNING

- [ ] kindswap-admin-backend production:
  - Single replica
  - ALB annotation: alb.ingress.kubernetes.io/inbound-cidrs = VPN CIDR only
  - Status: NEED TO VERIFY

- [ ] kindswap-admin-frontend production:
  - ALB annotation: alb.ingress.kubernetes.io/inbound-cidrs = VPN CIDR only
  - Status: NEED TO VERIFY

- [ ] Staging deployments:
  - All 4 services deployed
  - minReplicas=1, maxReplicas=3
  - CPU 100m, RAM 128Mi
  - pg-pool max 50 connections
  - Status: APPEARS RUNNING

- [ ] Dev deployments:
  - All 4 services deployed
  - 1 pod fixed (no HPA)
  - CPU 100m, RAM 128Mi
  - pg-pool max 40 connections
  - Status: APPEARS RUNNING

---

### S5 — Dual-Layer Rate Limiting

#### LAYER 1 — Cloudflare Edge Rate Limiting

Requirements:
- [ ] Cloudflare dashboard: kindswap.world zone
- [ ] Rate limiting rule:
  - Path: /api/*
  - Threshold: ??? requests per minute (NOT SPECIFIED IN PLAN - check if we set it)
  - Action: Block (or Challenge) on exceeding
- [ ] Rule status: Active in Cloudflare Security → WAF → Rate Limiting Rules
- [ ] Test: Burst requests from outside VPN → HTTP 429 at edge
- Status: **TERRAFORM MODULE CREATED but NOT DEPLOYED**

#### LAYER 2 — NestJS Application Rate Limiting

Requirements:
- [ ] @nestjs/throttler installed
  - Status: CONFIRMED INSTALLED

- [ ] ThrottlerModule in app.module.ts:
  - Configuration: ThrottlerModule.forRoot([{ ttl: 60000, limit: 15 }])
  - Status: **FIXED** - changed from 100 to 15

- [ ] @SkipThrottle() decorator:
  - Applied to health check endpoints (/health, /metrics)
  - Status: **FIXED** - added to health endpoint

- [ ] ThrottlerGuard registered globally
  - Status: NEED TO VERIFY

- [ ] Test: 16 rapid requests to /api/* via VPN → 16th returns 429
  - Status: NOT TESTED YET

- [ ] CloudWatch alarm:
  - Alert on 429 response rate > 5%
  - Status: NEED TO CREATE

---

### S6 — ALB + VPN Access Control

Requirements:
- [ ] ALB provisioned in public subnet
- [ ] Host-based routing for 4 domains:
  - kindswap.world → production (public)
  - stg.kindswap.world → staging (VPN-only)
  - dev.kindswap.world → dev (VPN-only)
  - master.kindswap.world → admin backend (VPN-only)
- [ ] Listener Rules: Source IP check against VPN CIDR, reject 403 if not in range
- [ ] HTTPS only: ACM certificate covers all 4 domains, HTTP→HTTPS redirect
- [ ] Cloudflare DNS: All 4 domains point to ALB DNS name
- [ ] Tests:
  - [ ] Disconnect VPN → stg.kindswap.world → 403
  - [ ] Connect VPN → stg.kindswap.world → 200
  - [ ] No VPN → kindswap.world → 200
  - [ ] No VPN → master.kindswap.world → 403
- [ ] Update VPN CIDR variable in Terraform (vpn_cidr)

**Status:** ALB exists, need to verify rules and test connectivity

---

### S7 — MFA Enforcement

#### Pritunl VPN MFA:
Requirements:
- [ ] Enable TOTP-based MFA in Pritunl admin panel
- [ ] All team member VPN profiles updated for TOTP
- [ ] Authenticator app: Google Authenticator, Authy, or 1Password (RFC 6238)
- [ ] VPN onboarding guide created for new team members
- Status: **NOT IMPLEMENTED YET**

#### AWS Console MFA:
Requirements:
- [ ] Attach MFA enforcement IAM policy to all IAM users with console access
- [ ] Test: Attempt AWS Console login with credentials only (no MFA) → AccessDeniedException
- [ ] Test: Complete MFA → same S3 describe → succeeds
- [ ] MFA Coverage:
  - Admin/Founders: VPN + Console TOTP
  - DevOps Team: VPN + Console TOTP
  - Backend Engineers: VPN TOTP only
  - Smart Contract Engineers: VPN TOTP only
- Status: **TERRAFORM MODULE CREATED but NOT DEPLOYED**

---

### S8 — Full CI/CD Pipeline

Requirements (v5 Pipeline):
- [ ] npm audit gate: --audit-level=high (HIGH or CRITICAL fail, LOW/MODERATE warn only)
- [ ] Docker build: node:20-slim confirmed
- [ ] ECR push: tag with commit SHA
- [ ] CVE gate: aws ecr describe-image-scan-findings, fail on Critical
- [ ] Cosign sign: sign with env://COSIGN_PRIVATE_KEY from Secrets Manager
- [ ] SBOM generate: syft → S3 with KMS encryption
- [ ] Pre-deploy snapshot (prod only): RDS snapshot with commit SHA, retained 30 days
- [ ] Image rollback: helm rollback to previous stable SHA in <2 min
- [ ] React RSC check: confirm no react-server or next dependencies in frontend package.json

#### Backend Pipeline Tests:
- [ ] Dev push → npm audit → build → ECR push → CVE gate → Cosign → SBOM → helm upgrade dev
- [ ] Staging merge → same pipeline → 1 manual approval → helm upgrade staging
- [ ] Main release tag → same pipeline → pre-deploy snapshot → senior approval → helm upgrade prod

#### Frontend Pipeline Tests:
- [ ] npm audit --audit-level=high
- [ ] npm run build (Vite)
- [ ] Docker build (nginx:alpine)
- [ ] ECR push
- [ ] CVE gate
- [ ] Cosign sign
- [ ] SBOM
- [ ] Deploy

#### Status:
- Last 3 builds: SUCCESS
- Need to verify each pipeline step present

---

## 🔍 ISSUES FOUND

### Critical Issues:
1. **S5 Layer 1 (Cloudflare):** Terraform module created but NOT DEPLOYED
   - Action: Requires manual Cloudflare API token to deploy

2. **S7 (MFA):** AWS policy created, Pritunl guide provided but NOT YET CONFIGURED
   - Action: Manual AWS policy attachment + Pritunl TOTP setup

3. **S4 (App Deployments):** Earlier task log shows we scaled backend to 0 replicas!
   - Action: Need to restore production backend immediately

### Medium Issues:
4. **S6 (ALB):** Need to verify VPN CIDR rules are correctly configured
   - Need to test all 4 VPN scenarios

5. **S5 (Rate Limiting):** CloudWatch alarm for 429 not verified
   - Need to confirm alarm created

6. **S2 (Controllers):** CSI Driver rotation interval (120s) not verified
   - Need to check configuration

### Verification Needed:
7. All network policies need verification
8. Secret mounts need verification  
9. ThrottlerGuard registration needs verification
10. React RSC check needs verification

---

## ✅ IMMEDIATE ACTIONS REQUIRED

**URGENT - PRODUCTION IS DOWN:**
- [ ] Restore production backend deployment (kubectl scale deployment kindswap-backend --replicas=2 -n production)

**Today:**
- [ ] Fix all critical issues above
- [ ] Verify all components end-to-end
- [ ] Create Pritunl setup guide
- [ ] Test all VPN scenarios
- [ ] Test rate limiting
- [ ] Test MFA
- [ ] Verify data streaming
- [ ] Create final sign-off report

---

*Status: Ready for detailed verification and fixes*
