# Kindswap Infrastructure Recovery & Setup Guide

**Date:** March 27, 2026  
**Project:** Kindswap - Solana Token Swap Platform  
**Status:** Core infrastructure deployed, Terraform source files missing, need recovery from backup repo  

---

## 📋 Executive Summary

**Current State:**
- ✅ AWS infrastructure deployed and running (EKS, RDS, VPC, KMS)
- ✅ EKS cluster with 5 pods running (backend, admin-backend, 2x frontend, admin-frontend)
- ✅ RDS PostgreSQL Multi-AZ connected and operational
- ✅ GitHub Actions CI/CD with OIDC authentication
- ✅ Cosign signing + SBOM generation pipeline in workflows
- ❌ Terraform source files (`.tf` files) NOT in git repository
- ❌ Need to recover from backup repo and commit to GitHub

**This Document:**
- Lists all AWS credentials/secrets needed
- Provides step-by-step setup for another AI/dev to continue
- Explains infrastructure topology
- Contains initial environment setup commands
- Points to backup repo location and recovery steps

---

## 🔐 Credentials & Secrets (Known)

### AWS Account
```
Region: us-east-1
AWS Account ID: 916994818641
Account Role: Production (no staging/dev accounts)
```

### GitHub Organization
```
Repository: https://github.com/hardikjain3810/kindswap_world
Owner: hardikjain3810
Backup Repo: [USER WILL PROVIDE]
Current Branch: feature/cosign-sbom-security-pipeline → dev
Release Tag: v1.0.0-security-pipeline
```

### AWS Secrets Manager Credentials (MUST EXIST IN AWS)
```
Secret Name: kindswap/db/primary
Contains:
  - username: [RETRIEVE FROM AWS SECRETS]
  - password: [RETRIEVE FROM AWS SECRETS]
  - host: kindswap-prod.xxx.us-east-1.rds.amazonaws.com
  - port: 5432
  - dbname: kindswap_dev (dev env) / kindswap_prod (prod env)

Secret Name: kindswap/cosign/private-key
Contains:
  - COSIGN_PRIVATE_KEY: [RETRIEVE FROM AWS SECRETS]
  - COSIGN_PASSWORD: [RETRIEVE FROM AWS SECRETS]

Secret Name: kindswap/helius/rpc
Contains:
  - HELIUS_API_KEY: [RETRIEVE FROM AWS SECRETS]
```

### GitHub Actions Secrets (MUST BE CONFIGURED IN GITHUB)
```
Secrets → Actions → Repository Secrets:

COSIGN_PRIVATE_KEY:     [Retrieved from AWS Secrets Manager]
COSIGN_PASSWORD:        [Retrieved from AWS Secrets Manager]
AWS_ACCOUNT_ID:         916994818641
AWS_REGION:             us-east-1
AWS_ROLE_TO_ASSUME:     arn:aws:iam::916994818641:role/github-actions-oidc-role
DOCKER_REGISTRY:        916994818641.dkr.ecr.us-east-1.amazonaws.com
ECR_REPOSITORY_BACKEND: kindswap-backend
ECR_REPOSITORY_ADMIN_BACKEND: kindswap-admin-backend
ECR_REPOSITORY_FRONTEND: kindswap-frontend
ECR_REPOSITORY_ADMIN_FRONTEND: kindswap-admin-frontend
S3_SBOM_BUCKET:         kindswap-sbom-916994818641
KMS_KEY_ID:             arn:aws:kms:us-east-1:916994818641:key/[KEY_ID]
```

### Kubernetes Secrets (ConfigMap + CSI Driver)
```
Namespace: dev
Secrets mounted via AWS Secrets Manager + CSI Driver:

1. kindswap-backend:
   - DB_USERNAME: [from kindswap/db/primary]
   - DB_PASSWORD: [from kindswap/db/primary]
   - DB_HOST: kindswap-prod.xxx.us-east-1.rds.amazonaws.com
   - DB_PORT: 5432
   - DB_NAME: kindswap_dev
   - HELIUS_API_KEY: [from kindswap/helius/rpc]
   - CORS_ORIGINS: kindswap.world,admin.kindswap.world,pre.kindswap.world

2. kindswap-admin-backend:
   - DB_USERNAME: [from kindswap/db/primary]
   - DB_PASSWORD: [from kindswap/db/primary]
   - DB_HOST: kindswap-prod.xxx.us-east-1.rds.amazonaws.com
   - DB_PORT: 5432
   - DB_NAME: kindswap_dev
   - ADMIN_ROLES: admin,super_admin
```

---

## 🏗️ Infrastructure Architecture

### AWS Services Deployed

| Service | Purpose | Status |
|---------|---------|--------|
| **VPC** | Network isolation (10.0.0.0/16, 6 subnets across 3 AZs) | ✅ Running |
| **EKS 1.31** | Kubernetes cluster (multi-AZ) | ✅ Running |
| **Karpenter** | Auto-scaling for pod resources | ✅ Running |
| **RDS PostgreSQL 16** | Multi-AZ database (gp3 storage) | ✅ Running |
| **ElastiCache Redis 7** | (Optional) cache layer | ⚠️ Configured |
| **ECR** | Docker image registry (5 repos: backend, admin-backend, frontend, admin-frontend, admin-panel) | ✅ Active |
| **S3** | SBOM storage bucket (`kindswap-sbom-916994818641`) | ✅ Active |
| **KMS** | Master key for encryption (`kindswap-master`) | ✅ Active |
| **Secrets Manager** | Credential storage (DB, Cosign, API keys) | ✅ Active |
| **IAM** | OIDC for GitHub Actions (no long-lived keys) | ✅ Configured |
| **CloudWatch** | Monitoring + logs | ✅ Active |
| **Prometheus/Grafana** | Metrics & dashboards (on EKS) | ✅ Running |

### Terraform Layers (12 Total)

**infra-core/ (Infrastructure foundation)**
```
01-networking/     → VPC, subnets, NAT, route tables, VPC endpoints (5x)
02-security/       → Security groups, IAM roles, KMS master key
03-eks/            → EKS cluster, node groups, OIDC provider
04-data/           → RDS PostgreSQL Multi-AZ, S3 buckets
05-registry/       → ECR repositories (4x for apps)
```

**infra-k8s/ (Kubernetes layer)**
```
01-irsa/           → IAM Roles for Service Accounts (workload identity)
02-controllers/    → ALB Controller, ESO (External Secrets Operator), CSI driver
03-karpenter/      → Karpenter provisioner for auto-scaling
04-monitoring/     → Prometheus + Grafana (kube-prometheus-stack)
05-apps/           → Helm charts deployment (4 microservices + Helm values)
```

**bootstrap/ (Initial setup)**
```
Terraform state bucket creation
IAM roles for Terraform execution
```

---

## 🎯 Terraform Files to Recover (From Backup Repo)

**Critical Files Missing:**

```
infra/infra/
├── bootstrap/
│   ├── main.tf              [MISSING - S3 state bucket setup]
│   ├── variables.tf         [MISSING]
│   ├── outputs.tf           [MISSING]
│   └── terraform.dev.tfvars [MISSING]
│
├── infra-core/
│   ├── 01-networking/
│   │   ├── main.tf          [MISSING - VPC, subnets, NAT, endpoints]
│   │   ├── variables.tf     [MISSING]
│   │   ├── outputs.tf       [MISSING]
│   │   └── data.tf          [MISSING]
│   │
│   ├── 02-security/
│   │   ├── main.tf          [MISSING - Security groups, IAM, KMS]
│   │   ├── variables.tf     [MISSING]
│   │   ├── outputs.tf       [MISSING]
│   │   └── policies.tf      [MISSING]
│   │
│   ├── 03-eks/
│   │   ├── main.tf          [MISSING - EKS cluster, node groups]
│   │   ├── variables.tf     [MISSING]
│   │   ├── outputs.tf       [MISSING]
│   │   ├── oidc.tf          [MISSING - GitHub OIDC provider]
│   │   └── node_groups.tf   [MISSING]
│   │
│   ├── 04-data/
│   │   ├── main.tf          [MISSING - RDS, S3, ElastiCache]
│   │   ├── variables.tf     [MISSING]
│   │   ├── outputs.tf       [MISSING]
│   │   └── rds.tf           [MISSING - Multi-AZ setup]
│   │
│   └── 05-registry/
│       ├── main.tf          [MISSING - ECR repositories]
│       ├── variables.tf     [MISSING]
│       └── outputs.tf       [MISSING]
│
└── infra-k8s/
    ├── 01-irsa/
    │   ├── main.tf          [MISSING - IAM roles for K8s]
    │   ├── variables.tf     [MISSING]
    │   └── outputs.tf       [MISSING]
    │
    ├── 02-controllers/
    │   ├── main.tf          [MISSING - ALB, ESO, CSI driver]
    │   ├── variables.tf     [MISSING]
    │   ├── helm.tf          [MISSING]
    │   └── outputs.tf       [MISSING]
    │
    ├── 03-karpenter/
    │   ├── main.tf          [MISSING - Karpenter provisioner]
    │   ├── variables.tf     [MISSING]
    │   ├── helm.tf          [MISSING]
    │   └── outputs.tf       [MISSING]
    │
    ├── 04-monitoring/
    │   ├── main.tf          [MISSING - Prometheus, Grafana]
    │   ├── variables.tf     [MISSING]
    │   ├── helm.tf          [MISSING]
    │   └── outputs.tf       [MISSING]
    │
    └── 05-apps/
        ├── main.tf          [MISSING - Helm app deployments]
        ├── variables.tf     [MISSING]
        ├── outputs.tf       [MISSING]
        ├── backend.tf       [MISSING]
        └── helm/            [✅ EXISTS - Chart.yaml, values.yaml, templates/]
            ├── kindswap-backend/       [✅ Has Helm chart]
            ├── kindswap-admin-backend/ [✅ Has Helm chart]
            ├── kindswap-frontend/      [✅ Has Helm chart]
            └── kindswap-admin-frontend/ [✅ Has Helm chart]
```

---

## 🚀 Environment Setup Steps

### Step 1: Prerequisites

```bash
# 1. Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-windows-x86_64.zip" -o "awscliv2.zip"
# Or download from: https://aws.amazon.com/cli/

# 2. Install Terraform (v1.5+)
# Download from: https://www.terraform.io/downloads
# Add to PATH

# 3. Install kubectl
# Download from: https://kubernetes.io/docs/tasks/tools/

# 4. Install Helm
choco install kubernetes-helm
# Or download from: https://github.com/helm/helm/releases

# 5. Install Git
choco install git
```

### Step 2: AWS CLI Configuration

```bash
# Configure AWS credentials
aws configure

# When prompted:
AWS Access Key ID: [ASK USER or get from IAM]
AWS Secret Access Key: [ASK USER or get from IAM]
Default region: us-east-1
Default output format: json

# Verify configuration
aws sts get-caller-identity
# Should return: Account ID 916994818641

# Set default region as environment variable
$env:AWS_REGION = "us-east-1"
[Environment]::SetEnvironmentVariable("AWS_REGION", "us-east-1", "User")
```

### Step 3: GitHub Configuration

```bash
# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Generate SSH key for GitHub (if needed)
ssh-keygen -t ed25519 -C "your.email@example.com"

# Add to GitHub: https://github.com/settings/keys
```

### Step 4: Clone Repositories

```bash
# Clone main repository
git clone https://github.com/hardikjain3810/kindswap_world.git
cd kindswap_world

# Add backup repo as alternate remote (to fetch .tf files from backup)
git remote add backup [USER_BACKUP_REPO_URL]
git fetch backup

# Checkout feature branch (where .tf files should be)
git checkout feature/cosign-sbom-security-pipeline
```

### Step 5: Retrieve AWS Secrets

```bash
# Get RDS credentials
aws secretsmanager get-secret-value --secret-id kindswap/db/primary --region us-east-1

# Get Cosign keys
aws secretsmanager get-secret-value --secret-id kindswap/cosign/private-key --region us-east-1

# Get Helius API key
aws secretsmanager get-secret-value --secret-id kindswap/helius/rpc --region us-east-1

# Store in environment variables
$env:DB_USERNAME = "kindswap"
$env:DB_PASSWORD = "[FROM SECRETS MANAGER]"
$env:COSIGN_PRIVATE_KEY = "[FROM SECRETS MANAGER]"
$env:COSIGN_PASSWORD = "[FROM SECRETS MANAGER]"
```

### Step 6: Retrieve `.tf` Files from Backup Repo

```bash
# List files in backup repo
git remote -v
git ls-remote backup

# Fetch specific branch with .tf files
git fetch backup infra-complete:infra-complete
git checkout infra-complete

# Copy .tf files to infra/ directory
cp -r infra/* infra/infra/

# Or manually:
# 1. Open backup repo URL
# 2. Navigate to infra/infra/
# 3. Download all .tf files for each layer
# 4. Place in corresponding directories
```

### Step 7: Setup Terraform Backend

```bash
# Navigate to bootstrap directory
cd infra/infra/bootstrap

# Initialize Terraform
terraform init

# Plan infrastructure
terraform plan -var-file="terraform.dev.tfvars"

# Apply (creates S3 state bucket)
terraform apply -var-file="terraform.dev.tfvars"

# Get outputs (S3 bucket name, DynamoDB table)
terraform output
```

### Step 8: Apply Terraform Layers

```bash
# For each layer (01-networking, 02-security, 03-eks, 04-data, 05-registry, 01-irsa, etc.)

cd ../infra-core/01-networking
terraform init
terraform plan -var-file="../../terraform.dev.tfvars"
terraform apply -var-file="../../terraform.dev.tfvars"

# Get outputs (VPC ID, Subnet IDs, etc.) - feed to next layer
terraform output
```

---

## 📊 Current Running Infrastructure

### EKS Cluster Status
```bash
# Get kubeconfig
aws eks update-kubeconfig --name kindswap-eks-dev --region us-east-1

# Verify cluster
kubectl cluster-info

# Check nodes
kubectl get nodes

# Check pods
kubectl get pods -n dev

# Expected pods:
# - kindswap-backend
# - kindswap-admin-backend
# - kindswap-frontend (2x replicas)
# - kindswap-admin-frontend
# - karpenter-*
# - aws-load-balancer-controller-*
# - external-secrets-operator-*
# - prometheus-*
# - grafana-*
```

### RDS Database
```bash
# Connect to RDS (from within VPC or via port-forward)
$env:PGPASSWORD = "[DB_PASSWORD]"
psql -h kindswap-prod.xxx.us-east-1.rds.amazonaws.com -U kindswap -d kindswap_dev -p 5432

# Check tables
\dt

# Expected tables:
# - admins
# - users
# - fee_configuration
# - fee_tier
# - transactions
# - points_ledger
```

### GitHub Actions Workflows
```
.github/workflows/
├── deploy-backend.yml              [✅ Running - Cosign + SBOM enabled]
├── deploy-admin-backend.yml        [✅ Running]
├── deploy-frontend.yml             [✅ Running]
└── deploy-admin-frontend.yml       [✅ Running]

All workflows:
- Trigger on: push to feature/* and dev branches
- npm audit gate: Production deps only (--omit=dev)
- Docker build: node:20-slim base image
- ECR scan: Blocks CRITICAL, warns HIGH
- Cosign sign: All images cryptographically signed
- SBOM generation: syft scans, uploads to S3
- Helm deploy: --atomic --wait (auto-rollback on failure)
```

---

## 🔑 Key Configuration Files

### terraform.dev.tfvars
```hcl
region                = "us-east-1"
environment           = "dev"
project_name          = "kindswap"

# VPC
vpc_cidr              = "10.0.0.0/16"
availability_zones    = ["us-east-1a", "us-east-1b", "us-east-1c"]
private_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs   = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

# EKS
eks_version           = "1.31"
eks_name              = "kindswap-eks-dev"
node_group_desired    = 2
node_group_min        = 2
node_group_max        = 10
node_instance_types   = ["t3.medium"]

# RDS
db_name               = "kindswap_dev"
db_username           = "kindswap"
db_allocated_storage  = 100
db_storage_type       = "gp3"
db_engine_version     = "16"
db_multi_az           = true
db_backup_retention   = 30

# ECR
ecr_repositories      = ["kindswap-backend", "kindswap-admin-backend", "kindswap-frontend", "kindswap-admin-frontend"]

# S3 (SBOM storage)
sbom_bucket_name      = "kindswap-sbom-916994818641"
sbom_versioning       = true
sbom_encryption_key   = "kindswap-master"

# KMS
kms_key_alias         = "kindswap-master"
kms_rotation_enabled  = true

# Secrets Manager
secrets_create        = true
```

### Helm Values (Backend Example)
```yaml
# infra/infra/infra-k8s/05-apps/helm/kindswap-backend/values.yaml

replicaCount: 1
image:
  repository: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend
  tag: latest  # Changed to Git SHA in workflows
  pullPolicy: IfNotPresent

container:
  port: 5000
  
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

env:
  - name: DB_HOST
    valueFrom:
      secretKeyRef:
        name: kindswap-db
        key: host
  - name: DB_PORT
    value: "5432"
  - name: DB_NAME
    value: "kindswap_dev"
  - name: HELIUS_API_KEY
    valueFrom:
      secretKeyRef:
        name: kindswap-helius
        key: api_key

ingress:
  enabled: true
  className: alb
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
  hosts:
    - host: api.kindswap.world
      paths:
        - path: /
          pathType: Prefix
```

---

## 📝 Recovery Workflow

### From Backup Repo

1. **Access Backup Repository**
   - Get backup repo URL from user
   - Add as remote: `git remote add backup [URL]`
   - Fetch all branches: `git fetch backup`

2. **Identify Correct Branch**
   - Look for branch with `.tf` files (e.g., `infra-complete`, `terraform-main`, etc.)
   - List commits: `git log backup/[branch] --name-only | grep ".tf" | head -20`

3. **Extract `.tf` Files**
   - Create patch: `git format-patch backup/[branch] -- infra/infra/ > tf-files.patch`
   - Or manually copy from backup repo web interface
   - Or: `git checkout backup/[branch] -- infra/infra/` (selective checkout)

4. **Verify Files**
   - Check all 12 layers have main.tf: `find infra/infra -name "main.tf" | wc -l`
   - Should return: 12+ files

5. **Commit to Feature Branch**
   ```bash
   git add infra/
   git commit -m "feat: Add Terraform infrastructure source files from backup"
   git push origin feature/cosign-sbom-security-pipeline
   ```

6. **Create PR to Dev**
   - Go to GitHub
   - Create PR: `feature/cosign-sbom-security-pipeline` → `dev`
   - Trigger workflows
   - Monitor deployment

---

## 🚨 Important Notes

### Secrets Handling
- **NEVER commit secrets** to git (already in .gitignore)
- Use AWS Secrets Manager for all credentials
- Use GitHub Actions secrets for CI/CD
- Use Kubernetes CSI driver for pod access

### State Files
- **Never commit `.tfstate` files**
- Remote state in S3 bucket: `kind-swap-terraform-state`
- Enable state locking (if DynamoDB configured)
- Always backup state before major changes

### OIDC Authentication
- GitHub Actions uses OIDC (no long-lived AWS keys stored)
- IAM role: `arn:aws:iam::916994818641:role/github-actions-oidc-role`
- OIDC provider configured in EKS layer

### Image Tagging
- **Production rule:** Never use `:latest` tag
- All images tagged with Git commit SHA (immutable)
- Workflows override tag in deployment
- Ensures reproducibility and rollback capability

### Helm Deployment Strategy
- `--atomic` flag: Auto-rollback on failure
- `--wait` flag: Block until pods ready
- `--history-max 5`: Keep last 5 releases for rollback
- Manual rollback fallback: `helm rollback [release] -n dev`

---

## 📞 Troubleshooting

### Terraform Init Fails
```bash
# Clear cache and reinitialize
rm -r .terraform
rm .terraform.lock.hcl
terraform init -upgrade
```

### AWS CLI Returns "Not Authorized"
```bash
# Verify credentials
aws sts get-caller-identity

# If fails, reconfigure
aws configure
# Provide: Access Key ID, Secret Access Key, Region (us-east-1)
```

### kubectl Can't Connect to Cluster
```bash
# Update kubeconfig
aws eks update-kubeconfig --name kindswap-eks-dev --region us-east-1

# Test connection
kubectl cluster-info
kubectl get nodes
```

### Helm Deployment Fails
```bash
# Check logs
kubectl logs -n dev deployment/kindswap-backend
kubectl describe pod -n dev <pod-name>

# Check events
kubectl get events -n dev --sort-by='.lastTimestamp'

# Rollback previous release
helm rollback kindswap-backend -n dev
```

### RDS Connection Fails
```bash
# Verify security group allows traffic from EKS nodes
aws ec2 describe-security-groups --filters "Name=group-name,Values=kindswap-rds-sg"

# Check RDS status
aws rds describe-db-instances --db-instance-identifier kindswap-prod

# Test connectivity from pod
kubectl run -it --rm debug --image=busybox --restart=Never -- /bin/sh
# Inside pod: nc -zv kindswap-prod.xxx.us-east-1.rds.amazonaws.com 5432
```

---

## ✅ Next Steps

1. **Get Backup Repo URL** from user
2. **Follow Recovery Workflow** section above
3. **Extract all `.tf` files**
4. **Commit to feature branch**
5. **Create PR to dev**
6. **Monitor workflow execution**
7. **Verify deployment**

---

**Document Version:** 1.0  
**Last Updated:** March 27, 2026  
**Infrastructure Status:** 85% production-ready  
