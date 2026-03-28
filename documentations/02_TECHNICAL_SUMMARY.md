# 📘 TECHNICAL SUMMARY: HOW KINDSWAP WORKS, SCALES & STAYS SECURE

**Document Version:** v5 (Final)  
**Date:** March 28, 2026  
**Audience:** Navdeep, Engineering Team, New Developers  

---

## 🎯 EXECUTIVE SUMMARY

KindSwap is a **decentralized token swap protocol** built on Solana blockchain with a **centralized ordering engine** (backend) that manages liquidity, user accounts, and transaction routing. The system is architected for **high availability, security, and scalability from 1K to 30K concurrent users**.

**Key Architecture Decision:** 
- **Frontend/API:** Centralized (AWS EKS) 
- **Blockchain Settlement:** Decentralized (Solana mainnet)
- **Data Storage:** Centralized (PostgreSQL RDS)
- **Infrastructure:** AWS (VPC, EKS, RDS, Secrets Manager, KMS)

---

## 🔄 HOW THE SWAP FLOW WORKS (END-TO-END)

### **Phase 1: User Initiates Swap (Frontend)**

```
1. User opens KindSwap UI
   ├─ Load JavaScript from IPFS / CDN
   ├─ Connect wallet (Phantom, Solflare, etc.)
   └─ Authenticate via wallet signature

2. User enters swap parameters
   ├─ From Token: e.g., USDC (amount: 1000)
   ├─ To Token: e.g., KIN (expected: 50,000)
   ├─ Slippage: 0.5%
   └─ Network: Solana Mainnet

3. Frontend requests quote from Backend API
   ├─ Endpoint: POST /api/v1/swap/quote
   ├─ Body: {from_token, to_token, amount, user_wallet}
   └─ Response: {best_route, price, fee_amount}
```

### **Phase 2: Backend Processes Request (API Server)**

```
1. Receive quote request in NestJS backend
   ├─ Rate limit check: 15 requests/60s (applied)
   ├─ User authentication: Validate wallet signature
   └─ Input validation: Amount > 0, tokens exist, slippage reasonable

2. Query blockchain state via Helius RPC
   ├─ Check: User's USDC balance (must be >= 1000)
   ├─ Check: All token account balances for routing
   └─ Purpose: Ensure sufficient liquidity

3. Call Jupiter API for best swap route
   ├─ Query: "How to swap 1000 USDC → KIN?"
   ├─ Jupiter searches: All available pools and routes
   ├─ Response: [route_1, route_2, route_3] with prices
   └─ Selection: Choose best rate + lowest fees

4. Call CoinGecko for price impact & slippage
   ├─ Check: Current market price of KIN/USDC
   ├─ Calculate: Expected vs actual slippage
   └─ Alert: If slippage > 1%, warn user

5. Store quote in database (audit log)
   ├─ Table: swap_quotes
   ├─ Columns: user_id, tokens, amounts, timestamp, route_id
   └─ Purpose: Audit trail + debugging

6. Return quote to Frontend
   ├─ Best price: 50,000 KIN expected
   ├─ Fee: 50 KIN (0.1% protocol fee)
   └─ Route: Exact pool sequence to execute
```

### **Phase 3: User Confirms Swap**

```
1. Frontend displays quote
   ├─ You send: 1000 USDC
   ├─ You receive: ~49,950 KIN (after fee)
   └─ Slippage: 0.01% (acceptable)

2. User clicks "Confirm Swap"
   └─ Frontend creates unsigned transaction

3. Frontend signs transaction with wallet
   ├─ User approves in Phantom/Solflare
   ├─ Signature: User signs exact tx bytes
   └─ Result: Signed transaction blob
```

### **Phase 4: Backend Executes Swap (Critical Path)**

```
1. Receive signed transaction from Frontend
   ├─ Endpoint: POST /api/v1/swap/execute
   ├─ Body: {signed_tx_blob, quote_id}
   └─ Validation: Signature matches quote

2. Verify quote freshness
   ├─ Check: Quote is < 30 seconds old
   ├─ Reason: Prevent stale quotes (price volatility)
   └─ Action: Reject if expired, force new quote

3. Re-query blockchain state (final check)
   ├─ Check: User's USDC balance still sufficient
   ├─ Check: Routes haven't changed dramatically
   ├─ Reason: Prevent failed transactions
   └─ If any issue: Reject and force new quote

4. Simulate transaction on blockchain
   ├─ Call Helius: "Dry-run this transaction"
   ├─ Purpose: Ensure tx will succeed before sending
   ├─ Check: All computations, token movements, fees
   └─ If fails: Return error, don't broadcast

5. Broadcast transaction to Solana network
   ├─ Method: sendTransaction RPC call
   ├─ Propagates: Mempool → validator nodes
   ├─ Confirmation: Desired (6 blocks ~ 5 seconds)
   └─ Status: Return tx_id to user immediately

6. Poll blockchain for confirmation
   ├─ Loop: Every 2 seconds, check tx status
   ├─ Timeout: 60 seconds (if not confirmed → timeout)
   ├─ States: Processing → Confirmed → Finalized
   └─ Update database when finalized
```

### **Phase 5: Settlement & Recording**

```
1. Once transaction finalized on blockchain
   ├─ User's wallet: -1000 USDC (confirmed)
   ├─ User's wallet: +49,950 KIN (confirmed)
   └─ Protocol vault: +50 KIN fee (locked)

2. Backend records settlement
   ├─ Update table: swap_transactions
   ├─ Set: status = 'finalized', amount_received = 49,950
   ├─ Set: confirmation_slot = 12345678
   └─ Commit: ACID transaction to DB

3. Update user balance (ledger)
   ├─ Table: user_balances
   ├─ Set: balance_usdc -= 1000, balance_kin += 49,950
   └─ Trigger: Leaderboard recalculation if needed

4. Update daily rotation metadata
   ├─ Table: rotation_history
   ├─ Set: total_volume_today += 1000 USD
   ├─ Set: total_fees_today += 50 KIN
   └─ Check: Has daily rotation threshold been reached?

5. Return confirmation to user
   ├─ Response: {
   │    status: 'confirmed',
   │    tx_id: '...',
   │    amount_sent: 1000 USDC,
   │    amount_received: 49,950 KIN,
   │    fee: 50 KIN,
   │    timestamp: '2026-03-28T13:45:30Z'
   │  }
   └─ Frontend: Show success, update wallet balances
```

---

## 🔐 VPN ACCESS MODEL

### **Why VPN?**

KindSwap admin endpoints (database management, credential access, deployment controls) are **NOT publicly accessible**. They require VPN access from a specific private network (CIDR: `10.50.0.0/16`).

### **VPN Architecture**

```
Outside (User's Home/Office) → Pritunl VPN → Inside (KindSwap Private Network)

1. Unauthenticated Request
   ├─ Source IP: User's ISP IP (e.g., 203.0.113.45)
   ├─ Destination: kindswap.world/admin
   └─ ALB receives request from 203.0.113.45
         ↓
   ALB Rule: "If Host=kindswap.world AND Source NOT in 10.50.0.0/16"
         ↓
   Return: 403 Forbidden (Access Denied)

2. Authenticated Request (Via VPN)
   ├─ User connects to Pritunl VPN
   │  └─ Downloads .ovpn profile
   │  └─ Enters TOTP code (2FA)
   │  └─ Establishes tunnel → VPN gateway
   │
   ├─ User assigned: IP 10.50.50.5 (from pool)
   │  └─ Now in private network 10.50.0.0/16
   │
   ├─ Request to kindswap.world/admin
   │  └─ Source IP: 10.50.50.5 (private)
   │  └─ Destination: kindswap.world/admin
   │
   └─ ALB Rule: "If Host=kindswap.world AND Source IN 10.50.0.0/16"
      └─ Return: 200 OK (Access Granted)
```

### **VPN Authentication Flow**

```
Step 1: Pritunl Client (Desktop/Mobile)
├─ Config: /path/to/kindswap.ovpn
└─ Contains: VPN gateway IP, port, certs

Step 2: OpenVPN/WireGuard Protocol
├─ Initiates: UDP 1194 (OpenVPN) or UDP 51820 (WireGuard)
└─ Handshake: mTLS certificate validation

Step 3: Pritunl Server Authentication
├─ Prompt: Enter username + password
└─ Backend: Check user exists in Pritunl DB

Step 4: MFA (TOTP)
├─ Prompt: Enter 6-digit code from Google Authenticator/Authy
├─ Verification: TOTP code must match secret key
└─ Security: Expires every 30 seconds

Step 5: Authorization
├─ Grant: User added to 10.50.0.0/16 CIDR pool
├─ Assign: Unique internal IP (10.50.x.x)
└─ Tunnel: Encrypted tunnel established

Step 6: Access
├─ User can now: Access admin.kindswap.world (403 → 200)
├─ User can now: SSH to bastion host (if configured)
└─ User cannot: Access internet directly (all traffic routed)

Step 7: Disconnect
├─ After: Session timeout (24 hours) OR manual disconnect
├─ Result: IP released back to pool
└─ Access: 403 Forbidden again
```

---

## 🔑 KMS ENCRYPTION CHAIN

### **Encryption Layers**

```
LAYER 1: Master Key (AWS KMS)
├─ Key: "kindswap-master-key"
├─ Type: Customer-managed (CMK)
├─ Policy: Highly restricted access
├─ Rotation: Annual (auto)
└─ Purpose: Master encryption key for everything

LAYER 2: Secrets Manager (AWS)
├─ Secret: "kindswap/api/db-password"
├─ Encryption: With Master Key (above)
├─ Rotation: Every 30 days (Lambda automation)
├─ Access: IRSA roles + CI/CD OIDC
└─ Value: Encrypted at rest, decrypted on fetch

LAYER 3: RDS Database (AWS)
├─ Encryption: KMS encrypted (same master key)
├─ At-Rest: All data files encrypted on disk
├─ In-Transit: SSL/TLS (port 5432 → encrypted)
└─ Backups: Encrypted with same key

LAYER 4: External Secrets Operator (Kubernetes)
├─ Component: ExternalSecret CRD
├─ Pulls: Secrets from Secrets Manager
├─ Mounts: As Kubernetes Secret (in-memory)
├─ TTL: Refreshed every 15 minutes
└─ Used by: Pods (via environment variables)

LAYER 5: Pod Environment Variables
├─ Source: ExternalSecret (from layer 4)
├─ Storage: Pod memory (in-memory)
├─ Access: Application code (NestJS)
├─ Lifetime: Pod lifecycle
└─ Protection: Kernel-level process isolation
```

### **Example: How DB_PASSWORD is Decrypted**

```
1. Infrastructure (Terraform) creates:
   └─ AWS Secrets Manager secret
      ├─ Name: kindswap/api/db-password
      ├─ Value: "secure_password_xyz"
      └─ Encryption: With KMS master key

2. Kubernetes (GitOps) deploys:
   └─ ExternalSecret resource
      ├─ References: kindswap/api/db-password
      ├─ Creates: Kubernetes Secret
      └─ Refreshes: Every 15 minutes

3. Pod startup (NestJS Backend):
   ├─ Mounts: Kubernetes Secret as env var
   ├─ Accesses: process.env.DB_PASSWORD
   ├─ Connects: new DataSource({ password: process.env.DB_PASSWORD })
   └─ Result: RDS connection established

4. Data at rest (Database):
   ├─ User data: Encrypted with KMS key
   ├─ Backups: Encrypted with KMS key
   ├─ PITR: Encrypted with KMS key
   └─ Result: No plaintext data on disk
```

---

## 🔄 DAILY ROTATION PROCESS

### **What Gets Rotated?**

```
Daily at 02:00 UTC (off-peak):

1. DB_PASSWORD (Primary RDS password)
   ├─ Old Password: AWSCURRENT (still works for grace period)
   ├─ New Password: Generated by Lambda
   ├─ Stored: AWSPENDING in Secrets Manager
   ├─ Grace Period: 7 days (old password still valid)
   └─ After: AWSCURRENT → new password (automatic swap)

2. API Keys (Helius, Jupiter, CoinGecko)
   ├─ Per-environment: dev, staging, prod
   ├─ Frequency: Monthly (less than DB password)
   └─ Method: External rotation (if vendor supports)

3. JWT Signing Keys (if using JWT)
   ├─ Not implemented: Currently using Solana wallet signatures
   └─ Future: When implementing sessions

4. Cosign Private Key
   ├─ Frequency: On-demand (not automatic)
   ├─ Method: Manual regeneration + sign all images
   └─ Reason: Security incident response
```

### **Rotation Flow (Detailed)**

```
STEP 1: Lambda Trigger
├─ EventBridge Rule: "Every day at 02:00 UTC"
├─ Trigger: rotate-db-password Lambda
└─ Invocation: Automatic (no manual action needed)

STEP 2: Generate New Password
├─ Lambda function:
│  ├─ Generate: 32-character random string (alphanumeric + symbols)
│  ├─ Characters: [A-Z, a-z, 0-9, !@#$%^&*()_+-=[]{}|;:,.<>?]
│  ├─ Avoid: Characters that break RDS parsing
│  └─ Result: "aB3$xY9@mK2#pL8&qW5!rT1*sJ4-uI7"
│
├─ Store: In Secrets Manager as AWSPENDING
│  ├─ Name: kindswap/api/db-password
│  ├─ Field: AWSPENDING = new password
│  ├─ Status: PendingSecret (waiting for verification)
│  └─ Encrypted: With KMS master key

STEP 3: Verify New Password
├─ Lambda:
│  ├─ Connect to RDS with AWSCURRENT (old password)
│  ├─ Execute: ALTER USER admin PASSWORD 'aB3$xY9@mK2#pL8&qW5!rT1*sJ4-uI7'
│  ├─ Result: Password changed on database
│  └─ Verify: Try connecting with new password
│
├─ Test connection:
│  ├─ Attempt: Connect to RDS with new password
│  ├─ Success: Execute SELECT 1 (simple query)
│  └─ Failure: Rollback (keep old password)

STEP 4: Finalize Rotation
├─ On Success:
│  ├─ Secrets Manager: AWSPENDING → AWSCURRENT
│  ├─ Old password: AWSCURRENT → AWSPREVIOUS
│  ├─ Grace period: 7 days (AWSPREVIOUS still works)
│  └─ Log: "Rotation completed successfully"
│
├─ On Failure:
│  ├─ Rollback: Delete AWSPENDING
│  ├─ Keep: AWSCURRENT unchanged
│  ├─ Alert: Send SNS notification to DevOps
│  └─ Log: "Rotation failed - manual investigation needed"

STEP 5: Pod Refresh
├─ ExternalSecret operator (watches Secrets Manager):
│  ├─ Detects: Secret changed (every 15 minutes)
│  ├─ Updates: Kubernetes Secret
│  └─ Result: All pods see new password
│
├─ Pod restart NOT required:
│  ├─ Each new connection: Uses latest password
│  ├─ Connection pooling: Old connections kept alive
│  ├─ Graceful: No downtime during rotation
│  └─ Result: Seamless password rotation

STEP 6: Audit Trail
├─ CloudTrail: Logs all Secrets Manager changes
│  ├─ Event: UpdateSecret (AWSPENDING created)
│  ├─ Event: RotateSecret (password changed)
│  ├─ Event: UpdateSecret (AWSCURRENT updated)
│  └─ Timestamp: All recorded with exact timestamps
│
├─ CloudWatch Logs: Lambda execution logs
│  ├─ Log: "Starting rotation for kindswap/api/db-password"
│  ├─ Log: "Generated new password"
│  ├─ Log: "Verified connection with new password"
│  └─ Log: "Rotation completed in 45 seconds"
```

---

## 📊 RATE LIMITING (TWO LAYERS)

### **Layer 1: Cloudflare Edge (DDoS Protection)**

```
Configuration:
├─ Type: WAF rule (Web Application Firewall)
├─ Threshold: 100 requests per 10 seconds
├─ Scope: All requests to kindswap.world
├─ Action: CAPTCHA challenge (slow attacker)
├─ Result: Legitimate users unaffected (< 10 req/s)

How it works:
├─ Request 1-100: Forwarded normally
├─ Request 101+: Return CAPTCHA (browser must solve)
├─ Valid CAPTCHA: Request forwarded (bucket reset)
├─ Invalid CAPTCHA: Blocked (IP tracked)

Purpose:
├─ Prevent: Botnet attacks (DDoS)
├─ Absorb: Spike traffic at Cloudflare (before ALB)
├─ Cost: Save AWS bandwidth charges
└─ Scale: Infinite - Cloudflare's network
```

### **Layer 2: NestJS Application (API Rate Limiting)**

```
Configuration (ThrottlerModule):
├─ Limit: 15 requests per 60 seconds
├─ Scope: Per IP address (or authenticated user)
├─ Endpoints: All /api/* routes
├─ Exceptions: /health, /status (no rate limit)

How it works:
├─ Request 1-15: Processed normally
├─ Request 16+: Return 429 Too Many Requests
├─ Response: Includes Retry-After header (60s)
├─ Client: Should wait before retrying

Purpose:
├─ Prevent: API abuse by individual users
├─ Protect: Database from overwhelming queries
├─ Fair: Distribute resources among users
└─ Cost: Reduce RDS load and costs

Implementation:
├─ Middleware: RequestLogger captures IP
├─ Guard: ThrottlerGuard enforces limit
├─ Storage: In-memory (can be Redis for distributed)
└─ Example: User from 10.50.50.5 can hit API 15x/min
```

### **Combined Example: Request Flow**

```
Request from attacker (DDoS):
├─ Layer 1 (Cloudflare): 
│  ├─ Requests 1-100: Pass
│  ├─ Request 101: CAPTCHA shown
│  └─ Requests without solving: Blocked
│
└─ Result: 99% of attack traffic stops at Cloudflare

Request from legitimate user:
├─ Layer 1 (Cloudflare): 
│  ├─ ~10 requests/minute: All pass
│  └─ Well below 100/10s threshold
│
├─ Layer 2 (NestJS):
│  ├─ 15 requests/60s limit
│  ├─ User sends: 5 requests in 10s
│  ├─ Result: 200 OK x5
│  └─ User stays within limit
│
└─ Result: User has seamless experience

Request from power user or runaway client:
├─ Layer 1 (Cloudflare):
│  └─ Passes (below DDoS threshold)
│
├─ Layer 2 (NestJS):
│  ├─ Requests 1-15: 200 OK
│  ├─ Request 16: 429 Too Many Requests
│  ├─ Retry-After: 60 seconds
│  └─ API protected
│
└─ Result: Backend stays available for others
```

---

## 🐳 DOCKER IMAGE SECURITY PIPELINE

### **4-Stage Pipeline (CI/CD)**

```
STAGE 1: ECR Scan
├─ When: Image pushed to ECR
├─ Tool: Amazon ECR Image Scan
├─ Scans: 
│  ├─ OS layer (Linux vulnerabilities)
│  ├─ Dependencies (Node.js, Python packages)
│  ├─ Known CVEs (cross-check against NVD database)
│  └─ Results: Critical, High, Medium, Low severities
│
└─ Output: Scan report (JSON, available in AWS console)

STAGE 2: CVE Gate (Failure = Block)
├─ Trigger: Scan completes
├─ Check: Count CRITICAL CVEs
├─ Rule: If CRITICAL > 0 → FAIL (stop pipeline)
├─ Rule: If HIGH > 10 → FAIL (stop pipeline)
├─ Rule: If passed → Continue to next stage
│
└─ Purpose: Never deploy vulnerable images

STAGE 3: Cosign Sign (Image Integrity)
├─ When: CVE gate passes
├─ Tool: Cosign (supply-chain security)
├─ Inputs:
│  ├─ Image: 916994.../kindswap-backend:abc123
│  ├─ Private Key: From AWS Secrets Manager
│  └─ Command: cosign sign --key /tmp/cosign.key $IMAGE
│
├─ Output: Signature stored in OCI artifact registry
└─ Purpose: Verify image hasn't been tampered with

STAGE 4: SBOM Generation (Bill of Materials)
├─ When: Image signed
├─ Tool: Syft (SBOM generator)
├─ Creates: Software Bill of Materials
├─ Contents:
│  ├─ OS packages (alpine:3.18, libc version X, etc)
│  ├─ Installed packages (node:18, npm 9.x, etc)
│  ├─ Application dependencies (typescript, nestjs, etc)
│  ├─ Versions: Exact semver for each
│  └─ Hashes: SHA256 for verification
│
├─ Format: JSON or CycloneDX XML
├─ Storage: Artifact registry or S3
└─ Purpose: Track exactly what's in every image (supply-chain transparency)
```

### **Reviewing Scan Results (DevOps Responsibility)**

```
Step 1: Find scan results in AWS Console
├─ Navigate: ECR → Repositories → kindswap-backend
├─ View: "Image scan findings"
├─ Filter: By severity (CRITICAL, HIGH, MEDIUM, LOW)
│
└─ Example:
   ├─ CRITICAL: openssl (CVE-2022-3786) in base image
   ├─ HIGH: npm audit (jQuery 3.5.1) in node_modules
   └─ MEDIUM: Glibc (local privilege escalation)

Step 2: Triage findings
├─ Question 1: Is this in production? (If yes → critical)
├─ Question 2: Is this exploitable in our context?
│  ├─ Example: Openssl remote code execution
│  │  └─ Exploitable: YES (API server exposed)
│  └─ Example: Glibc local priv escalation
│     └─ Exploitable: NO (requires pod escape + local access)
│
├─ Question 3: Can we patch? (upgrade dependency)
│  ├─ Example: npm audit fix (may fix most)
│  └─ Update package.json → rebuild
│
└─ Question 4: If we can't patch, can we mitigate?
   ├─ Example: Run pod with limited privileges (securityContext)
   ├─ Example: Use network policy to restrict access
   └─ Example: Monitor for exploitation attempts (Sentry)

Step 3: If CRITICAL CVE found
├─ Immediate action:
│  ├─ Update base image to latest patch
│  ├─ Run `npm audit fix` to update deps
│  ├─ Rebuild image locally & test
│  ├─ Re-scan to confirm CVE gone
│  └─ Force-push new tag (rebuild production)
│
├─ Temporary mitigation (if urgent):
│  ├─ Deploy with NetworkPolicy (restrict access)
│  ├─ Enable Pod Security Policy (restricted)
│  ├─ Monitor with Sentry (watch for attacks)
│  └─ Plan patch for next deploy
│
└─ Timeline: CRITICAL → fix within 24 hours
```

---

## 📈 SCALING FROM 1K TO 30K USERS

### **Resource Planning**

```
User Tier    Nodes    CPU/Memory    Backend    RTO      Cost
─────────────────────────────────────────────────────────────
1K users     3        500m/512Mi    1 pod      N/A      $150/mo
3K users     5        1000m/1Gi     2 pods     2 min    $300/mo
10K users    10       2000m/2Gi     4 pods     2 min    $600/mo
30K users    20       4000m/4Gi     10 pods    1 min    $1200/mo
```

### **Automatic Scaling Triggers**

```
Horizontal Pod Autoscaler (HPA):
├─ Metric: CPU Usage > 70% of requested (500m)
├─ Action: Add 1 pod (up to max 10)
├─ Cooldown: 1 minute (prevent thrashing)
├─ Example:
│  ├─ 4 pods @ 75% CPU = 8 cores needed
│  ├─ Trigger: Add pod #5
│  ├─ New distribution: 5 pods @ 60% CPU
│  └─ State: Stable (under 70%)

Karpenter Node Autoscaler:
├─ Metric: Pod pending > 2 minutes
├─ Action: Provision new node (t3.large → t3.xlarge)
├─ Consolidation: Remove underutilized nodes
├─ Example:
│  ├─ 3 nodes @ 60% CPU = all nodes underutilized
│  ├─ Action: Consolidate to 2 nodes
│  ├─ Result: Reduce cost + maintain performance
│  └─ State: Optimal efficiency

Combination Effect:
├─ Traffic surge (1K → 5K requests/sec):
│  ├─ T+0s: Requests queue
│  ├─ T+10s: HPA detects CPU > 70%
│  ├─ T+15s: New pod scheduled
│  ├─ T+30s: New pod started, traffic balanced
│  └─ T+1m: System stable with 2x pods
│
└─ Timeline: Handle surge within 2 minutes
```

### **Database Scaling**

```
At 1K-3K users:
├─ Single RDS instance (t3.large)
├─ 100 GB storage
├─ ~100 connections max
└─ Cost: $100/month

At 10K users:
├─ Multi-AZ RDS (t3.xlarge)
├─ Read replica (for analytics queries)
├─ 500 GB storage
├─ ~200 connections max
└─ Cost: $300/month

At 30K users (future):
├─ RDS with read replicas (multiple)
├─ Connection pooling (PgBouncer)
├─ Potential sharding (by user_id % 4)
├─ 2 TB storage
└─ Cost: $600/month (estimate)

Connection Pooling Strategy:
├─ Tool: PgBouncer (if needed)
├─ Config: 200 client connections → 20 server connections
├─ Benefit: Reduce connection overhead
└─ When: RDS connections maxing out
```

---

## 📋 SUMMARY TABLE: COMPONENTS & SCALE

| Component | 1K Users | 10K Users | 30K Users | Notes |
|-----------|----------|-----------|-----------|-------|
| EKS Nodes | 3 | 10 | 20 | Auto-scaled by Karpenter |
| Backend Pods | 1 | 4 | 10 | Auto-scaled by HPA |
| RDS Instance | t3.large | t3.xlarge | t3.2xlarge + replicas | Multi-AZ from 3K users |
| ALB Connections | ~1K | ~10K | ~30K | AWS handles automatically |
| Cloudflare Requests | 10 req/s | 100 req/s | 300 req/s | Rate limited: 100/10s |
| API Rate Limit | 15/min | 15/min | 15/min | Per-user limit |
| Cost/Month | $150 | $600 | $1200 | Estimated |

---

## ✅ SECURITY FEATURES SUMMARY

| Feature | Implementation | Status |
|---------|---|---|
| Secret Encryption | KMS + Secrets Manager | ✅ Active |
| VPN Access | Pritunl + CIDR 10.50.0.0/16 | ✅ Active |
| Image Scanning | ECR + CVE gate | ✅ Active |
| Image Signing | Cosign + signatures | ✅ Active |
| Rate Limiting | Cloudflare (100/10s) + NestJS (15/60s) | ✅ Active |
| MFA Enforcement | AWS IAM + TOTP | ✅ Active |
| Database Isolation | Private subnets + SG | ✅ Active |
| Audit Logging | CloudTrail + CloudWatch | ✅ Active |
| Backup/Recovery | 7-day PITR + Multi-AZ | ✅ Active |
| Monitoring | Prometheus + Grafana + Sentry | ✅ Active |

---

**Document:** TECHNICAL SUMMARY  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
