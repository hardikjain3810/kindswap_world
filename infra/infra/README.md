# KindSwap Infrastructure

Production AWS infrastructure for **KindSwap** — a Solana-based token swap platform with points rewards system. Managed entirely with Terraform using a layered approach.

---

## Overview

| Component | Domain | Technology |
|-----------|--------|------------|
| **Frontend** | `kindswap.world` | React + Vite + TypeScript → S3 + CloudFront |
| **Backend API** | `api.kindswap.world` | NestJS (Node.js) → Docker → EKS + ALB |
| **Auth** | Cognito hosted UI | AWS Cognito User Pool + ALB authentication |
| **Database** | Private subnet | RDS PostgreSQL 16 (Multi-AZ, 40GB) |
| **Cache** | Private subnet | ElastiCache Redis 7 |
| **Monitoring** | `grafana.kindswap.world` | Prometheus + Grafana (kube-prometheus-stack) |
| **DNS** | Cloudflare | Manual CNAME records (existing site on Lightsail) |
| **CI/CD** | GitHub Actions | OIDC federation (no long-lived AWS keys) |

**Region:** `us-east-1` (Mumbai)
**AWS Account:** Single account, production only
**Terraform State:** S3 bucket `kind-swap-terraform-state` (no DynamoDB locking)

---

## Architecture

```
                        Cloudflare DNS
                       /       |       \
                      /        |        \
           kindswap.world  api.kindswap.world  grafana.kindswap.world
                |              |                      |
          CloudFront       ALB (HTTPS)            ALB (HTTPS)
          + OAC            + Cognito Auth         + ACM cert
                |              |                      |
           S3 Bucket       EKS Cluster            EKS Cluster
          (static SPA)     (NestJS pods)       (Grafana + Prometheus)
                               |
                    ┌──────────┼──────────┐
                    |          |          |
                RDS Postgres  Redis   Secrets Manager
                (Multi-AZ)   (cache)  (DB creds, Redis endpoint)
```

### Key Design Decisions

- **Layered Terraform** — 12 layers with separate state files. Each layer can be destroyed/rebuilt independently without affecting others.
- **EKS 1.31 with Access Entries API** — Modern auth (not deprecated aws-auth ConfigMap).
- **Core node group (2x t3.medium, no taints)** — Runs system controllers (ALB, ESO, Karpenter, monitoring). No scheduling issues.
- **Karpenter** — Autoscales app workload nodes (t3.medium/large/xlarge, on-demand + spot, max 80 CPU).
- **1 Regional NAT Gateway** — Cost-optimized (~$32/month vs ~$96/month for 3 per-AZ). Upgrade for HA if needed.
- **IRSA (IAM Roles for Service Accounts)** — Each K8s workload gets its own scoped IAM role. No shared credentials.
- **External Secrets Operator** — Syncs AWS Secrets Manager to K8s secrets. No hardcoded credentials.
- **Cognito** — User Pool for frontend sign-up/sign-in. ALB authenticates API requests before they reach the backend.
- **ACM certificates** — Specific certs (not wildcard) so existing Lightsail site is unaffected during migration.
- **AES256 for S3** — CloudFront OAC compatible (KMS would require extra key policy config).

---

## Application Details

### Frontend — `ksoul2/KindSoul-F`

| Property | Value |
|----------|-------|
| Framework | React + Vite + TypeScript + Tailwind CSS + shadcn-ui |
| Build | `npm run build` → `dist/` |
| Dockerfile | Multi-stage: `node:20-bullseye` (build) → `nginx:alpine` (serve) |
| Port | 80 (nginx) |
| Deploy | S3 sync + CloudFront invalidation |

### Backend — `ksoul2/kindsoul-b`

| Property | Value |
|----------|-------|
| Framework | NestJS (Node.js) + TypeORM + PostgreSQL + Redis |
| Build | `npm run build` → `dist/main.js` |
| Dockerfile | Multi-stage: `node:20-alpine` (build) → `node:20-alpine` (run) |
| Port | 3000 |
| Health | `GET /api/health` |
| Deploy | Docker → ECR → Helm → EKS |

**Backend API endpoints:** `/api/swap/complete`, `/api/points/:wallet`, `/api/swaps/:wallet`, `/api/leaderboard`, `/api/stats`, `/api/config/fee-config`, `/api/config/fee-tiers`, `/api/admin/*`

**Environment variables** (injected via External Secrets from AWS Secrets Manager):
- `DATABASE_URL` — from `kind_swap_db_credentials`
- `REDIS_URL` — from `kind_swap_redis_endpoint`
- `PORT=3000`, `NODE_ENV=production`

---

## Directory Structure

```
infra/
├── bootstrap/                  # One-time: create the S3 state bucket
├── github-actions/             # CI/CD workflow files (copy to repos)
│   ├── backend-deploy.yml      # Build Docker → ECR → Helm deploy to EKS
│   └── frontend-deploy.yml     # npm build → S3 sync → CloudFront invalidation
├── infra-core/                 # AWS infrastructure (no K8s dependency)
│   ├── 01-networking/          # VPC, subnets, 1x NAT Gateway (regional)
│   ├── 02-security/            # KMS keys, OIDC, IAM roles (GitHub Actions, SSM)
│   ├── 03-eks/                 # EKS cluster 1.31, managed node group, EBS CSI driver
│   ├── 04-data/                # RDS PostgreSQL 16, ElastiCache Redis 7, Secrets Manager
│   ├── 05-registry/            # ECR repositories (kind_swap_backend, kind_swap_frontend)
│   └── 06-cognito/             # Cognito User Pool, SPA + ALB clients, hosted domain
└── infra-k8s/                  # Kubernetes-dependent resources
    ├── 01-irsa/                # IRSA IAM roles for K8s service accounts
    ├── 02-controllers/         # ALB Controller, External Secrets, Metrics Server, ACM certs
    ├── 03-karpenter/           # Karpenter autoscaler, NodePool, EC2NodeClass
    ├── 04-monitoring/          # kube-prometheus-stack (Prometheus + Grafana)
    └── 05-apps/
        ├── backend-chart/      # Helm chart for the backend API (NestJS)
        └── frontend/           # Terraform: S3 bucket + CloudFront distribution
```

---

## Apply Order

Apply layers **in this exact order**. Each layer reads outputs from previous layers via `terraform_remote_state`.

### Step 0 — Bootstrap (run once)

```bash
cd infra/bootstrap
terraform init && terraform apply
```

Creates the `kind-swap-terraform-state` S3 bucket for all Terraform state.

---

### Step 1 — Networking

```bash
cd infra/infra-core/01-networking
terraform init && terraform apply
```

Creates:
- VPC `10.0.0.0/16`
- 3 public + 3 private + 3 database subnets across `us-east-1a/b/c`
- Internet Gateway
- **1 regional NAT Gateway** (cost-optimized, ~$32/month)
- Route tables, VPC flow logs

---

### Step 2 — Security

```bash
cd infra/infra-core/02-security
terraform init && terraform apply
```

Creates:
- KMS keys (EKS envelope encryption, RDS, S3)
- GitHub Actions OIDC provider + IAM role (ECR push, EKS deploy, S3 sync, CloudFront invalidation)
- SSM management IAM role (node access without SSH)

---

### Step 3 — EKS

```bash
cd infra/infra-core/03-eks
terraform init && terraform apply
```

Creates:
- EKS cluster v1.31 (`authentication_mode = "API"`)
- Core managed node group: 2x `t3.medium`, 30GB gp3, no taints
- OIDC provider for IRSA
- EBS CSI driver addon (required for PVC provisioning)
- Access Entries for Karpenter nodes

> **Note:** Node group creation takes ~25-35 minutes.

**After apply** — connect kubectl:
```bash
aws eks update-kubeconfig --name kind_swap_cluster --region us-east-1
kubectl get nodes   # verify 2 nodes are Ready
```

---

### Step 4 — Data

```bash
cd infra/infra-core/04-data
terraform init && terraform apply
```

Creates:
- RDS PostgreSQL 16 — Multi-AZ, `db.t3.medium`, 40GB, KMS encrypted, `deletion_protection = true`
- ElastiCache Redis 7 — `cache.t3.micro`, single node
- Secrets Manager secrets: `kind_swap_db_credentials`, `kind_swap_redis_endpoint`

> **Note:** RDS creation takes ~10-15 minutes.

---

### Step 5 — ECR Registry

```bash
cd infra/infra-core/05-registry
terraform init && terraform apply
```

Creates: ECR repositories (`kind_swap_backend`, `kind_swap_frontend`) with lifecycle policies (keep last 30 images) and scan-on-push.

---

### Step 6 — Cognito (User Authentication)

```bash
cd infra/infra-core/06-cognito
terraform init && terraform apply
```

Creates:
- **Cognito User Pool** (`kind_swap_user_pool`) — email sign-in, password policy (8+ chars), email verification, deletion protection
- **Hosted UI domain:** `kindswap.auth.us-east-1.amazoncognito.com`
- **Frontend SPA client** — public (no secret), authorization code + PKCE, callbacks for `kindswap.world` + `localhost:5173`
- **ALB client** — confidential (with secret), callback to `api.kindswap.world/oauth2/idpresponse`

**After apply — note the outputs for GitHub Actions secrets:**
```bash
terraform output frontend_cognito_config       # Frontend env vars (VITE_COGNITO_*)
terraform output cognito_alb_auth_annotations   # ALB auth values
terraform output -raw alb_client_secret        # ALB client secret (sensitive)
```

**Build the `COGNITO_ALB_IDP_JSON` secret** for the backend deploy workflow:
```bash
USER_POOL_ARN=$(terraform output -raw user_pool_arn)
ALB_CLIENT_ID=$(terraform output -raw alb_client_id)
POOL_DOMAIN=$(terraform output -json cognito_alb_auth_annotations | jq -r '.user_pool_domain')

# This JSON string is the value for the COGNITO_ALB_IDP_JSON GitHub secret
echo "{\"userPoolARN\":\"$USER_POOL_ARN\",\"userPoolClientID\":\"$ALB_CLIENT_ID\",\"userPoolDomain\":\"$POOL_DOMAIN\"}"
```

---

### Step 7 — IRSA

```bash
cd infra/infra-k8s/01-irsa
terraform init && terraform apply
```

Creates: IRSA IAM roles for ALB Controller, Karpenter, External Secrets Operator, Prometheus.

---

### Step 8 — Controllers + ACM Certificates

```bash
cd infra/infra-k8s/02-controllers
terraform init && terraform apply
```

Creates:
- AWS Load Balancer Controller (Helm)
- External Secrets Operator (Helm)
- Metrics Server (Helm)
- ACM certs: `api.kindswap.world`, `grafana.kindswap.world`, `kindswap.world` (frontend cert in `us-east-1` for CloudFront)

**ACTION REQUIRED — Add ACM validation CNAMEs to Cloudflare:**

```bash
terraform output acm_api_validation_records
terraform output acm_grafana_validation_records
terraform output acm_frontend_validation_records
```

For each output, add in Cloudflare DNS:
- **Type:** CNAME
- **Name:** the `name` value (e.g., `_3a5b1c7ee55ef605d2ee4bb7fa426e81.api`)
- **Content:** the `value` field
- **Proxy status:** DNS only (grey cloud)

> These validation records do NOT affect existing traffic. Wait ~5 min for certs to show `Issued`.

---

### Step 9 — Karpenter

```bash
cd infra/infra-k8s/03-karpenter
terraform init && terraform apply
```

Creates:
- Karpenter Helm release
- SQS interruption queue + 4 EventBridge rules (spot/rebalance/state-change/health)
- EC2NodeClass: AL2023, 30GB gp3, private subnets
- NodePool: `t3.medium/large/xlarge`, on-demand + spot, max 80 CPU, consolidation policy `WhenEmptyOrUnderutilized`

---

### Step 10 — Monitoring

```bash
cd infra/infra-k8s/04-monitoring
terraform init && terraform apply
```

Creates:
- kube-prometheus-stack (Prometheus 15d retention + 20Gi gp2 storage, Grafana 5Gi gp2 storage, Alertmanager 2Gi gp2 storage)
- Grafana ALB ingress at `grafana.kindswap.world`
- Grafana admin password in Secrets Manager (`kind_swap_grafana_password`)

**Retrieve Grafana password:**
```bash
terraform output -raw grafana_admin_password
# or:
aws secretsmanager get-secret-value --secret-id kind_swap_grafana_password --region us-east-1
```

---

### Step 11 — Frontend (S3 + CloudFront)

```bash
cd infra/infra-k8s/05-apps/frontend
terraform init && terraform apply
```

Creates:
- S3 bucket (private, versioned, AES256 encrypted)
- CloudFront distribution with OAC, HTTP/2+3, `PriceClass_All`
- SPA fallback (403/404 → `index.html`)
- Bucket policy (CloudFront-only access)

**After apply — note the CloudFront domain:**
```bash
terraform output cloudflare_cname_instructions
```

> Do NOT add the `kindswap.world` CNAME yet — only add it when you're ready to switch traffic from Lightsail to CloudFront.

---

## Authentication Flow (Cognito)

```
User visits kindswap.world
        |
   Frontend SPA (React)
   Uses Cognito SDK with PKCE
        |
   Sign up / Sign in via Cognito Hosted UI
   (kindswap.auth.us-east-1.amazoncognito.com)
        |
   Receives JWT tokens (id_token, access_token, refresh_token)
        |
   Calls api.kindswap.world with Authorization header
        |
   ALB receives request → Cognito auth action validates JWT
        |
   Valid → forwards to NestJS backend pods
   Invalid → redirects to Cognito login
```

**Two Cognito clients:**
| Client | Type | Use |
|--------|------|-----|
| `kind_swap_frontend` | Public (no secret) | React SPA uses PKCE for sign-in |
| `kind_swap_alb_auth` | Confidential (with secret) | ALB validates tokens on every API request |

**Frontend env vars** (set at build time via GitHub Actions):
- `VITE_COGNITO_REGION=us-east-1`
- `VITE_COGNITO_USER_POOL_ID` — from Terraform output
- `VITE_COGNITO_CLIENT_ID` — frontend client ID
- `VITE_COGNITO_DOMAIN` — hosted UI URL

---

## Cloudflare DNS — When to Add What

### Add NOW (safe, no traffic impact):
| Record | Type | Name | Content | Proxy |
|--------|------|------|---------|-------|
| ACM validation (api) | CNAME | `_hash.api` | `_hash.acm-validations.aws.` | DNS only |
| ACM validation (grafana) | CNAME | `_hash.grafana` | `_hash.acm-validations.aws.` | DNS only |
| ACM validation (root) | CNAME | `_hash` | `_hash.acm-validations.aws.` | DNS only |

### Add LATER (when ready to switch traffic from Lightsail):
| Record | Type | Name | Content | Proxy |
|--------|------|------|---------|-------|
| Frontend | CNAME | `kindswap.world` / `@` | `dxxxx.cloudfront.net` | DNS only |
| Backend API | CNAME | `api` | ALB DNS from `kubectl get ingress -A` | DNS only |
| Grafana | CNAME | `grafana` | ALB DNS from `kubectl get ingress -n monitoring` | DNS only |

> **Important:** Only switch the `kindswap.world` CNAME when the new CloudFront+S3 setup is tested and ready. The existing Lightsail site continues serving until you change DNS.

---

## GitHub Actions Setup

### Secrets for both repos (`ksoul2/KindSoul-F` and `ksoul2/kindsoul-b`):

| Secret | How to get |
|--------|-----------|
| `AWS_ROLE_ARN` | `cd infra/infra-core/02-security && terraform output github_actions_role_arn` |

### Additional — backend only (`ksoul2/kindsoul-b`):

| Secret | How to get |
|--------|-----------|
| `ACM_BACKEND_CERT_ARN` | `cd infra/infra-k8s/02-controllers && terraform output acm_api_certificate_arn` |
| `COGNITO_ALB_IDP_JSON` | See Step 6 output instructions above |

### Additional — frontend only (`ksoul2/KindSoul-F`):

| Secret | How to get |
|--------|-----------|
| `FRONTEND_S3_BUCKET` | `cd infra/infra-k8s/05-apps/frontend && terraform output frontend_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `cd infra/infra-k8s/05-apps/frontend && terraform output cloudfront_distribution_id` |
| `COGNITO_USER_POOL_ID` | `cd infra/infra-core/06-cognito && terraform output user_pool_id` |
| `COGNITO_FRONTEND_CLIENT_ID` | `cd infra/infra-core/06-cognito && terraform output frontend_client_id` |
| `COGNITO_DOMAIN` | `cd infra/infra-core/06-cognito && terraform output user_pool_domain` |

### Workflow files — copy to repos:
| Source (this repo) | Destination |
|-------------------|-------------|
| `infra/github-actions/backend-deploy.yml` | `ksoul2/kindsoul-b/.github/workflows/backend-deploy.yml` |
| `infra/github-actions/frontend-deploy.yml` | `ksoul2/KindSoul-F/.github/workflows/frontend-deploy.yml` |
| `infra/infra-k8s/05-apps/backend-chart/` | `ksoul2/kindsoul-b/helm/backend-chart/` |

### CI/CD Flow

**Backend** (`push to main` → `ksoul2/kindsoul-b`):
1. Checkout code
2. Configure AWS via OIDC (no secrets, just role ARN)
3. Build Docker image (`node:20-alpine`, multi-stage)
4. Push to ECR (`kind_swap_backend:$COMMIT_SHA` + `:latest`)
5. Update kubeconfig for EKS
6. `helm upgrade --install` with image tag, ACM cert, Cognito config
7. Wait for rollout + verify

**Frontend** (`push to main` → `ksoul2/KindSoul-F`):
1. Checkout code
2. `npm ci` + `npm run build` (Vite, with `VITE_API_URL`, `VITE_COGNITO_*` env vars)
3. Configure AWS via OIDC
4. `aws s3 sync ./dist` to S3 (assets with 1-year cache, HTML with no-cache)
5. CloudFront cache invalidation (`/*`)

---

## Helm Chart — Backend

The backend Helm chart (`infra/infra-k8s/05-apps/backend-chart/`) deploys the NestJS API:

| Resource | Details |
|----------|---------|
| Deployment | 2 replicas, `node:20-alpine`, port 3000 |
| Service | ClusterIP:3000 |
| Ingress | ALB, internet-facing, HTTPS, Cognito auth |
| HPA | min 2 → max 10 pods (CPU 70%, Memory 80%) |
| PDB | minAvailable: 1 |
| ExternalSecret | Syncs `kind_swap_db_credentials` + `kind_swap_redis_endpoint` from Secrets Manager |
| Health checks | Liveness + Readiness at `/api/health` |
| Security | `runAsNonRoot`, `runAsUser: 1000`, drop ALL capabilities |
| Topology | Spread across AZs, anti-affinity across nodes |

**Values set at deploy time** (via `--set` in GitHub Actions):
- `image.repository` + `image.tag` — ECR image
- `ingress.annotations.alb.ingress.kubernetes.io/certificate-arn` — ACM cert
- `ingress.annotations.alb.ingress.kubernetes.io/auth-idp-cognito` — Cognito config JSON

---

## Secrets Management

```
AWS Secrets Manager                    Kubernetes
┌──────────────────────┐     ESO      ┌────────────────────────┐
│ kind_swap_db_credentials │ ──────→ │ kind-swap-backend-secrets │
│ kind_swap_redis_endpoint │ ──────→ │ kind-swap-redis-secret    │
│ kind_swap_grafana_password│         │ (monitoring namespace)    │
└──────────────────────┘              └────────────────────────┘
```

- **External Secrets Operator (ESO)** periodically syncs (every 1h) secrets from AWS Secrets Manager into K8s secrets.
- Backend pods mount these as environment variables.
- No credentials are hardcoded in code, Helm values, or CI/CD pipelines.

---

## Networking

```
VPC: 10.0.0.0/16
├── Public subnets (10.0.1-3.0/24)    — ALBs, NAT Gateway
├── Private subnets (10.0.11-13.0/24) — EKS nodes, pods
└── Database subnets (10.0.21-23.0/24) — RDS, ElastiCache

Internet → IGW → Public subnets → ALB → Private subnets (pods)
Pods → NAT Gateway (1 regional) → Internet (for ECR pulls, etc.)
```

3 AZs: `us-east-1a`, `us-east-1b`, `us-east-1c`

---

## Encryption

| Resource | Method |
|----------|--------|
| EKS secrets (etcd) | KMS envelope encryption |
| RDS PostgreSQL | KMS at-rest encryption |
| Secrets Manager | KMS (AWS managed) |
| S3 frontend bucket | AES256 (CloudFront OAC compatible) |
| EBS volumes (nodes) | Default AWS EBS encryption |
| In-transit | TLS everywhere (ACM certs on ALB + CloudFront) |

---

## Useful Commands

```bash
# Connect to cluster
aws eks update-kubeconfig --name kind_swap_cluster --region us-east-1

# Check nodes (core + Karpenter-managed)
kubectl get nodes -o wide

# Check all pods across namespaces
kubectl get pods -A

# Check ALB ingress endpoints (get ALB DNS names for Cloudflare)
kubectl get ingress -A

# Check Karpenter nodes
kubectl get nodeclaims
kubectl get nodepools

# Access node via SSM (no SSH needed)
aws ssm describe-instance-information --region us-east-1
aws ssm start-session --target <instance-id> --region us-east-1

# Get DB credentials
aws secretsmanager get-secret-value --secret-id kind_swap_db_credentials \
  --region us-east-1 --query SecretString --output text | jq .

# Get Redis endpoint
aws secretsmanager get-secret-value --secret-id kind_swap_redis_endpoint \
  --region us-east-1 --query SecretString --output text | jq .

# Get Grafana password
aws secretsmanager get-secret-value --secret-id kind_swap_grafana_password \
  --region us-east-1 --query SecretString --output text | jq .

# Check backend deployment
kubectl get pods -n production -l app.kubernetes.io/instance=kind-swap-backend
kubectl logs -n production -l app.kubernetes.io/instance=kind-swap-backend --tail=50

# Check monitoring stack
kubectl get pods -n monitoring
kubectl get pvc -n monitoring

# Helm releases
helm list -A
```

---

## Cost Estimate (Monthly)

| Resource | Estimated Cost |
|----------|---------------|
| EKS control plane | ~$73 |
| NAT Gateway (1 regional) | ~$32 + data |
| EC2 (2x t3.medium core nodes) | ~$60 |
| RDS PostgreSQL (db.t3.medium, Multi-AZ) | ~$50 |
| ElastiCache Redis (cache.t3.micro) | ~$12 |
| ALB (2 — backend + monitoring) | ~$32 |
| CloudFront | ~$0-10 (usage-based) |
| S3 | ~$1 |
| Secrets Manager (3 secrets) | ~$1.20 |
| ECR | ~$1 |
| Cognito | Free tier (50K MAU) |
| **Total (baseline)** | **~$260-280/month** |

> Karpenter will add EC2 costs as workload scales. Spot instances reduce this significantly.

---

## Destroy Order (reverse of apply)

```bash
# Destroy in REVERSE order
cd infra/infra-k8s/05-apps/frontend && terraform destroy
cd infra/infra-k8s/04-monitoring && terraform destroy
cd infra/infra-k8s/03-karpenter && terraform destroy
cd infra/infra-k8s/02-controllers && terraform destroy
cd infra/infra-k8s/01-irsa && terraform destroy
cd infra/infra-core/06-cognito && terraform destroy      # NOTE: has deletion_protection=ACTIVE
cd infra/infra-core/05-registry && terraform destroy
cd infra/infra-core/04-data && terraform destroy          # NOTE: RDS has deletion_protection=true
cd infra/infra-core/03-eks && terraform destroy
cd infra/infra-core/02-security && terraform destroy
cd infra/infra-core/01-networking && terraform destroy
# bootstrap/ — keep the state bucket unless fully done
```

> **Warning:** Before destroying:
> - **RDS:** Set `deletion_protection = false` in `04-data/main.tf`, apply, then destroy.
> - **Cognito:** Set `deletion_protection = "INACTIVE"` in `06-cognito/main.tf`, apply, then destroy.
> - **EKS:** Ensure all Helm releases and K8s resources are cleaned up first (infra-k8s layers).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| PVCs stuck in Pending | Check EBS CSI driver: `kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver` |
| Nodes not joining cluster | Verify Access Entries: `aws eks list-access-entries --cluster-name kind_swap_cluster` |
| Helm timeout | Check node availability: `kubectl get nodes`. Core nodes may need time to start. |
| ALB not creating | Check ALB controller logs: `kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller` |
| ACM cert stuck in Pending | Verify CNAME records in Cloudflare. Use `aws acm describe-certificate` to check status. |
| Karpenter not scaling | Check NodePool: `kubectl describe nodepool default`. Check EC2NodeClass: `kubectl describe ec2nodeclass default` |
| External Secrets not syncing | Check ESO logs: `kubectl logs -n kube-system -l app.kubernetes.io/name=external-secrets` |
| Cognito auth 401 on ALB | Verify `auth-idp-cognito` annotation JSON format and client IDs match |

