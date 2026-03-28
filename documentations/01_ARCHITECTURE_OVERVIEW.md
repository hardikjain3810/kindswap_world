# 🏗️ KINDSWAP HIGH-LEVEL ARCHITECTURE DIAGRAM & OVERVIEW

**Document Version:** v5 (Final)  
**Date:** March 28, 2026  
**Audience:** Navdeep, DevOps Team, New Engineers  
**Format:** Markdown with ASCII diagram + PNG/PDF exports ready  

---

## 📐 COMPLETE NETWORK ARCHITECTURE

```
                          INTERNET (External Users)
                                  ↓
                    ┌─────────────────────────┐
                    │   CLOUDFLARE EDGE       │
                    │   (Rate Limiting)       │
                    │   100 req/10s throttle  │
                    └────────────┬────────────┘
                                 ↓
                    ┌─────────────────────────┐
                    │   ALB (kindswap-alb)    │
                    │   us-east-1             │
                    │   Security Group:       │
                    │   - 80/443 public       │
                    └────────┬────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓
   ┌──────────┐         ┌──────────┐        ┌──────────┐
   │  Route   │         │  Route   │        │  Route   │
   │  Rule 1  │         │  Rule 2  │        │  Rule 3  │
   │          │         │          │        │          │
   │Hostname  │         │Path:     │        │Fallback: │
   │match:    │         │/admin/*  │        │forward   │
   │kindswap. │         │→Admin    │        │to Backend│
   │world     │         │Backend   │        │          │
   │→Backend  │         │TG        │        │TG        │
   │TG        │         │          │        │          │
   └──────────┘         └──────────┘        └──────────┘
        ↓                    ↓                    ↓
        └────────────────────┼────────────────────┘
                             ↓
                    ┌─────────────────────────┐
                    │ VPC: vpc-08a60df...     │
                    │ CIDR: 10.0.0.0/16       │
                    │                         │
                    │ ┌─────────────────────┐ │
                    │ │ NAT Instance        │ │
                    │ │ Subnet:10.0.30.0/24 │ │
                    │ │ Provides egress for  │ │
                    │ │ EKS & Lambda         │ │
                    │ └─────────────────────┘ │
                    │                         │
                    │ 6 SUBNETS:              │
                    └─────────────────────────┘
                             │
        ┌────────┬───────────┼───────────┬────────┐
        ↓        ↓           ↓           ↓        ↓
        
    PUBLIC SUBNETS (2)          PRIVATE SUBNETS (4)
    
    ┌──────────────┐          ┌──────────────────┐
    │ 10.0.10.0/24 │          │ 10.0.20.0/24     │
    │ us-east-1a   │          │ us-east-1a (EKS) │
    │ (NAT GW)     │          │ AZ1              │
    └──────────────┘          └──────────────────┘
                              │ SG: app-tier-sg  │
    ┌──────────────┐          │ Rules:           │
    │ 10.0.11.0/24 │          │ - In: 80/443     │
    │ us-east-1b   │          │   from ALB       │
    │              │          │ - Out: All       │
    └──────────────┘          └──────────────────┘

    ┌──────────────┐          ┌──────────────────┐
    │ 10.0.12.0/24 │          │ 10.0.21.0/24     │
    │ us-east-1c   │          │ us-east-1a (RDS) │
    │              │          │ Private          │
    └──────────────┘          └──────────────────┘
                              │ SG: rds-sg       │
                              │ Rules:           │
                              │ - In: 5432       │
                              │   from app-sg    │
                              │ - Out: None      │
                              └──────────────────┘

    ┌──────────────┐          ┌──────────────────┐
    │ 10.0.13.0/24 │          │ 10.0.22.0/24     │
    │ us-east-1c   │          │ us-east-1b (RDS) │
    │              │          │ Private          │
    └──────────────┘          └──────────────────┘
                              │ SG: rds-sg       │
                              │ Rules:           │
                              │ - In: 5432       │
                              │   from app-sg    │
                              │ - Out: None      │
                              └──────────────────┘
```

---

## 🎯 KUBERNETES CLUSTER (EKS: kindswap-eks)

```
┌──────────────────────────────────────────────────────────┐
│ EKS Cluster: kindswap-eks                                │
│ Version: 1.28 (latest)                                   │
│ Region: us-east-1                                        │
│ Multi-AZ: 3 availability zones (a, b, c)                │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Node Group: general-purpose (t3.large, t3.xlarge)│  │
│ │ Min: 3 | Desired: 5 | Max: 20                    │  │
│ │ Auto-scaling enabled via Karpenter               │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│  NAMESPACE: production                                  │
│  ├─ Deployment: kindswap-backend (4 replicas)          │
│  │  ├─ Image: 916994...ecr.../kindswap-backend:v5  │
│  │  ├─ Ports: 3000/TCP (health: :3001)              │
│  │  ├─ Resources:                                    │
│  │  │  ├─ Requests: CPU 500m, Memory 512Mi          │
│  │  │  └─ Limits: CPU 1000m, Memory 1024Mi          │
│  │  ├─ Secrets: ExternalSecret from Secrets Manager│
│  │  │  ├─ DB_HOST, DB_PASSWORD                     │
│  │  │  ├─ HELIUS_KEY, JUPITER_KEY                  │
│  │  │  └─ COINGECKO_KEY, SENTRY_DSN                │
│  │  └─ HPA: CPU 70% → scale to 10 replicas         │
│  │                                                  │
│  ├─ Deployment: kindswap-frontend (2 replicas)        │
│  │  ├─ Image: 916994...ecr.../kindswap-frontend    │
│  │  ├─ Ports: 80/TCP                               │
│  │  └─ ConfigMap: routing rules                     │
│  │                                                  │
│  ├─ Deployment: kindswap-admin-backend (2 replicas)   │
│  │  ├─ Image: 916994...ecr.../kindswap-admin-back  │
│  │  ├─ Ports: 3000/TCP                             │
│  │  └─ Secrets: Admin-specific credentials         │
│  │                                                  │
│  └─ Deployment: kindswap-admin-panel (1 replica)      │
│     ├─ Image: 916994...ecr.../kindswap-admin-panel │
│     └─ Ports: 80/TCP                               │
│                                                          │
│  NAMESPACE: staging                                     │
│  ├─ All deployments: reduced replicas (1-2)            │
│  ├─ Same images as production (different tag)          │
│  └─ Secrets: staging credentials from Secrets Manager  │
│                                                          │
│  NAMESPACE: dev                                         │
│  ├─ All deployments: single replica                    │
│  ├─ Different base images (dev builds)                 │
│  └─ Secrets: dev credentials                          │
│                                                          │
│  NAMESPACE: kube-system                                │
│  ├─ CoreDNS (service discovery)                       │
│  ├─ VPC CNI (networking: Calico)                      │
│  ├─ ebs-csi-driver (persistent volumes)               │
│  ├─ efs-csi-driver (shared storage)                   │
│  └─ external-secrets-operator (Secrets Manager sync)   │
│                                                          │
│  NAMESPACE: cosign                                     │
│  ├─ Webhook: cosign-verifier                          │
│  ├─ Policy: ValidatingWebhookConfiguration            │
│  └─ Function: Verify Cosign signatures before admission│
│                                                          │
│  NAMESPACE: monitoring                                 │
│  ├─ Prometheus (metrics scraper)                      │
│  ├─ Grafana (dashboards)                              │
│  ├─ Alert Manager (AlertManager rules)                │
│  └─ Loki (log aggregation)                            │
└──────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│ RDS Multi-AZ Cluster (PostgreSQL 14)                   │
│                                                         │
│ Primary Instance: kindswap-prod                        │
│ ├─ Endpoint: kindswap-prod.cXXXXXX.us-east-1.rds.amaz │
│ ├─ Port: 5432                                         │
│ ├─ Multi-AZ: Enabled (automatic failover)             │
│ ├─ Backups: 7-day retention, automated daily          │
│ ├─ PITR: Available (point-in-time recovery)           │
│ ├─ Encryption: KMS encrypted (key-id:...)            │
│ ├─ Subnets: Private (10.0.21.0/24, 10.0.22.0/24)     │
│ ├─ Security Group: rds-security-group                │
│ │  ├─ Inbound: TCP 5432 from app-tier-sg only        │
│ │  └─ Outbound: None (database only receives)        │
│ │                                                    │
│ └─ Logical Databases:                                │
│    └─ kindswap_prod (3 schemas)                       │
│       ├─ public (swap, liquidity, user tables)        │
│       ├─ audit (transaction logs, rotation history)   │
│       └─ internal (system tables, metadata)           │
│                                                         │
│ Standby Instance: kindswap-prod-standby              │
│ ├─ Endpoint: Auto-managed (read-only or failover)    │
│ ├─ Role: Hot-standby in us-east-1b                   │
│ ├─ Failover: < 2 minutes RTO                         │
│ └─ Purpose: HA and disaster recovery                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Non-Production RDS (kindswap-nonprod)                  │
│ ├─ Environment: staging + dev (shared)                │
│ ├─ Endpoint: kindswap-nonprod.cXXXXXX.us-east-1...   │
│ ├─ Multi-AZ: Disabled (cost optimization)             │
│ ├─ Backups: 3-day retention (minimal)                 │
│ ├─ Encryption: Same KMS key (shared master)           │
│ └─ Logical Databases:                                │
│    ├─ kindswap_staging (test data, weekly refresh)    │
│    └─ kindswap_dev (developer sandbox)                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 SECURITY BOUNDARIES & GROUPS

```
┌─────────────────────────────────────────────────────────┐
│ Security Group: alb-security-group                      │
│ ├─ Inbound:                                             │
│ │  ├─ TCP 80 from 0.0.0.0/0 (HTTP)                    │
│ │  └─ TCP 443 from 0.0.0.0/0 (HTTPS)                  │
│ ├─ Outbound: All traffic to app-tier-sg (3000, 80)    │
│ └─ Use: ALB accepts external traffic                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Security Group: app-tier-security-group                │
│ ├─ Inbound:                                             │
│ │  ├─ TCP 3000 from alb-sg (API traffic)              │
│ │  ├─ TCP 80 from alb-sg (frontend)                   │
│ │  └─ TCP 3001 from monitoring-sg (health checks)    │
│ ├─ Outbound:                                            │
│ │  ├─ TCP 5432 to rds-sg (database)                   │
│ │  ├─ TCP 443 to 0.0.0.0/0 (external APIs)           │
│ │  └─ TCP 53 to 0.0.0.0/0 (DNS)                       │
│ └─ Use: EKS pods/containers                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Security Group: rds-security-group                      │
│ ├─ Inbound:                                             │
│ │  ├─ TCP 5432 from app-tier-sg ONLY                  │
│ │  └─ No external/internet access                     │
│ ├─ Outbound: None (DB only accepts connections)       │
│ └─ Use: RDS instances                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Security Group: lambda-security-group                   │
│ ├─ Inbound: None (Lambda invoked internally)           │
│ ├─ Outbound:                                            │
│ │  ├─ TCP 5432 to rds-sg (credential rotation)        │
│ │  ├─ TCP 443 to 0.0.0.0/0 (AWS APIs)                 │
│ │  └─ TCP 53 to 0.0.0.0/0 (DNS)                       │
│ └─ Use: Credential rotation Lambda function           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Security Group: monitoring-security-group              │
│ ├─ Inbound: None                                        │
│ ├─ Outbound:                                            │
│ │  ├─ TCP 3001 to app-tier-sg (health checks)        │
│ │  ├─ TCP 5432 to rds-sg (metrics)                   │
│ │  └─ TCP 443 to 0.0.0.0/0 (external logs)           │
│ └─ Use: Prometheus, Grafana, Loki pods               │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 ENCRYPTION & KMS ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│ KMS Master Key (kindswap-master-key)                   │
│ ├─ Key ID: arn:aws:kms:us-east-1:916994...:key/XXX   │
│ ├─ Usage: Master encryption key for all secrets        │
│ ├─ Rotation: Annual (AWS managed)                      │
│ ├─ Access: IRSA roles + CI/CD (OIDC) only             │
│ │                                                      │
│ └─ Encrypts:                                           │
│    ├─ AWS Secrets Manager (all secrets)              │
│    ├─ RDS databases (at-rest)                        │
│    ├─ EBS volumes (Kubernetes PVCs)                  │
│    ├─ EFS (shared storage)                           │
│    ├─ ECR images (metadata)                          │
│    └─ CloudWatch logs                                │
│                                                       │
│ Key Policy:                                           │
│ ├─ Allow: AWS Lambda (credential rotation)           │
│ ├─ Allow: RDS (encrypt database)                     │
│ ├─ Allow: EKS IRSA (decrypt secrets)                 │
│ ├─ Allow: ECR (scan metadata)                        │
│ └─ Deny: Any unauthenticated access                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Secrets Manager (kindswap/* namespace)                 │
│ ├─ kindswap/api/db-host                               │
│ │  └─ Value: kindswap-prod.cXXXXXX.us-east-1.rds... │
│ │                                                      │
│ ├─ kindswap/api/db-password                           │
│ │  └─ Rotated every 30 days (Lambda automation)      │
│ │                                                      │
│ ├─ kindswap/api/helius-rpc-key                       │
│ │  └─ External API key (Helius RPC endpoint)        │
│ │                                                      │
│ ├─ kindswap/api/jupiter-api-key                      │
│ │  └─ External API key (Jupiter DEX aggregator)     │
│ │                                                      │
│ ├─ kindswap/api/coingecko-key-1 & key-2             │
│ │  └─ External API keys (price feeds)               │
│ │                                                      │
│ ├─ kindswap/api/sentry-dsn                          │
│ │  └─ Error tracking (Sentry endpoint)              │
│ │                                                      │
│ └─ kindswap/cosign/private-key                       │
│    └─ Cosign image signing key (CI/CD only)         │
│                                                       │
│ All values encrypted with kindswap-master-key       │
│ All rotations logged in CloudTrail                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🌐 EXTERNAL SERVICES & INTEGRATIONS

```
┌─────────────────────────────┐
│   Helius RPC (Solana)      │
│   ├─ Endpoint: mainnet     │
│   ├─ Auth: API key         │
│   └─ Use: Blockchain queries
└─────────────┬───────────────┘
              │ (HTTPS/TCP 443)
              │
┌─────────────────────────────┐
│   Jupiter DEX               │
│   ├─ Endpoint: Mainnet      │
│   ├─ Auth: API key          │
│   └─ Use: Token swap quotes │
└─────────────┬───────────────┘
              │ (HTTPS/TCP 443)
              │
┌─────────────────────────────┐
│   CoinGecko Price Feed      │
│   ├─ Endpoint: API v3       │
│   ├─ Auth: API key          │
│   └─ Use: Price data        │
└─────────────┬───────────────┘
              │ (HTTPS/TCP 443)
              │
┌─────────────────────────────┐
│   Sentry Error Tracking     │
│   ├─ Project: KindSwap v5   │
│   ├─ Auth: DSN              │
│   └─ Use: Error logging     │
└─────────────┬───────────────┘
              │ (HTTPS/TCP 443)
              │
        ┌─────┴──────┐
        │             │
      NAT Instance (Egress)
        │             │
        └─────┬───────┘
              │
    ┌─────────┴──────────┐
    │ EKS Cluster (pods) │
    └─────────────────────┘
```

---

## 🔄 DATA FLOW: COMPLETE SWAP TRANSACTION

```
User (External) via Cloudflare
         ↓
    HTTP/HTTPS (80/443)
         ↓
  Cloudflare Edge
  (Rate limit: 100 req/10s)
         ↓
    Verify: Is from 10.50.0.0/16 (VPN)?
    ├─ NO  → Return 403 Forbidden
    └─ YES → Forward to ALB
         ↓
 Load Balancer (kindswap-alb)
 ├─ HTTP → redirect to HTTPS
 └─ HTTPS (443) → forward to target group
         ↓
 Target Group Backend
 ├─ Health check: port 3001/health
 └─ Forward: port 3000 (API)
         ↓
 EKS Pod: kindswap-backend (one of 4 replicas)
 ├─ Receive: POST /api/v1/swap
 ├─ Rate limit: 15 req/60s (ThrottlerGuard)
 ├─ Validate: User wallet signature
 │
 ├─ Fetch: Helius RPC (blockchain state)
 │  └─ Query: Token balance, accounts
 │
 ├─ Fetch: Jupiter API (best route)
 │  └─ Query: Get swap quote
 │
 ├─ Query: CoinGecko (price impact)
 │  └─ Query: Current token prices
 │
 ├─ Connect: RDS (write transaction)
 │  ├─ Insert: swap_transactions table
 │  ├─ Update: user_balance (ledger)
 │  └─ Commit: ACID transaction
 │
 ├─ Emit: Event to Sentry (optional logging)
 │  └─ Log: Swap details (non-sensitive)
 │
 ├─ Return: Response (200 OK with tx_id)
 │
 └─ Cache: Redis (if enabled)
    └─ Key: "swap:{user_id}:{pair}"
         ↓
User (Receive response)
```

---

## 📊 SCALING ARCHITECTURE (1K → 30K Users)

```
┌──────────────────────────────────────────┐
│ AT 1K USERS                              │
├──────────────────────────────────────────┤
│ EKS Nodes: 3 (t3.large, 1K → 2K req/s) │
│ Backend Replicas: 1 (single pod)        │
│ RDS: Single instance (nonprod OK)       │
│ Load Average: < 20%                     │
└──────────────────────────────────────────┘
           ↓ (Scale up 3x)
┌──────────────────────────────────────────┐
│ AT 3K USERS                              │
├──────────────────────────────────────────┤
│ EKS Nodes: 5 (mixed t3.large/xlarge)   │
│ Backend Replicas: 2 (HPA triggered)    │
│ RDS: Multi-AZ (high availability)      │
│ Load Average: 40-50%                   │
└──────────────────────────────────────────┘
           ↓ (Scale up 3x)
┌──────────────────────────────────────────┐
│ AT 10K USERS                             │
├──────────────────────────────────────────┤
│ EKS Nodes: 10 (t3.xlarge + t3.2xlarge) │
│ Backend Replicas: 4 (HPA: 15 possible) │
│ RDS: Read replicas (if needed)         │
│ Load Average: 60-70%                   │
│ Karpenter: Auto-scales node pool       │
└──────────────────────────────────────────┘
           ↓ (Scale up 3x)
┌──────────────────────────────────────────┐
│ AT 30K USERS                             │
├──────────────────────────────────────────┤
│ EKS Nodes: 20+ (Karpenter-managed)     │
│ Backend Replicas: 10+ (HPA max)        │
│ RDS: Read-only replicas (API calls)    │
│ Load Average: 70-80% (safe range)      │
│ Cloudflare: Cache + rate limit         │
│ Database: Shard if TPS > 10K/s         │
└──────────────────────────────────────────┘

HPA (Horizontal Pod Autoscaler) Rules:
├─ Metric: CPU > 70%
│  └─ Action: Add replica (+1 pod)
├─ Metric: CPU < 30%
│  └─ Action: Remove replica (-1 pod)
├─ Min Replicas: 1
└─ Max Replicas: 15

Karpenter Node Pool Rules:
├─ Metric: Node CPU > 80%
│  └─ Action: Add node
├─ Metric: Pod pending > 2 minutes
│  └─ Action: Provision new node
├─ Min Nodes: 3
└─ Max Nodes: 20 (auto-scale beyond → manual review)
```

---

## 🎯 DIAGRAM EXPORT NOTES

**For PNG/PDF Generation:**
- Use Lucidchart, Miro, or Draw.io with this ASCII layout
- Color scheme:
  - 🟦 AWS services (blue)
  - 🟩 Kubernetes (green)
  - 🟨 External services (yellow)
  - 🟥 Security/Database (red)
  - 🟧 User-facing (orange)
- Export as: 
  - PNG (300 dpi for presentations)
  - PDF (for technical documentation)
  - SVG (for web)

---

**Document:** HIGH-LEVEL ARCHITECTURE DIAGRAM  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
