# KindSwap Development Environment - Complete Setup & Testing Plan
**Date**: March 23, 2026  
**Environment**: Development (Lightweight AWS + Local Docker)  
**Estimated Setup Time**: 2-3 hours  
**Estimated Monthly Cost**: ~$35-50 (vs $100-150 for full prod)

---

## 📋 Table of Contents
1. [Environment Architecture](#architecture)
2. [Phase 1: Local Development (No AWS)](#phase-1-local-development)
3. [Phase 2: Lightweight AWS Infrastructure](#phase-2-aws-infrastructure)
4. [Phase 3: Container Builds & Scanning](#phase-3-container-builds)
5. [Phase 4: Application Deployment](#phase-4-deployment)
6. [Phase 5: Testing & Validation](#phase-5-testing)
7. [Cost Breakdown](#cost-breakdown)
8. [Troubleshooting](#troubleshooting)

---

## Architecture

### Dev Environment Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Setup                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Local Development                AWS Dev Infrastructure     │
│  ├─ Docker Desktop                ├─ RDS PostgreSQL t3.micro│
│  ├─ PostgreSQL 16                 ├─ EC2 t3.small (backend) │
│  ├─ Redis 7                       ├─ EC2 t3.small (frontend)│
│  ├─ Backend (NestJS)              ├─ ECR (container images) │
│  ├─ Frontend (React)              └─ Minimal VPC            │
│  ├─ Admin Panel (React)                                      │
│  └─ Admin Backend (NestJS)                                   │
│                                                               │
│  Components Running: ALL 4 (Backend + 3 frontends)           │
│  Database: Fresh PostgreSQL (no backup restore)              │
│  Testing: Unit + E2E + Manual endpoint validation           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Why This Approach?

| Component | Why | Cost Impact |
|-----------|-----|-------------|
| **RDS t3.micro** | Development database, single-AZ | ~$15/month vs $60+ for prod |
| **EC2 t3.small** | Light workload compute | ~$9/month ea vs t3.medium prod |
| **No Multi-AZ** | Dev doesn't need HA | Save 50% on RDS |
| **Minimal VPC** | Reuse existing networking | No extra cost |
| **Local docker-compose first** | Fast iteration, zero AWS cost initially | Dev can work offline |

---

## Phase 1: Local Development (No AWS Required)

### Step 1.1: Docker Desktop Setup
```bash
# Verify Docker is running
docker --version
docker-compose --version

# Expected:
# Docker version 25.0+
# Docker Compose version 2.0+
```

### Step 1.2: Create Local docker-compose.yml

**File**: `docker-compose.local.yml` (for offline development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: kindswap-postgres-dev
    environment:
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpass123
      POSTGRES_DB: kindswap_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devuser -d kindswap_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: kindswap-redis-dev
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data_dev:
```

**Run Local Stack**:
```bash
cd d:\D\kindswap
docker-compose -f docker-compose.local.yml up -d

# Wait for services to be healthy (30 seconds)
docker-compose -f docker-compose.local.yml logs

# Verify connections
docker exec kindswap-postgres-dev psql -U devuser -d kindswap_dev -c "\dt"
docker exec kindswap-redis-dev redis-cli PING
```

### Step 1.3: Backend Setup

**Database Migrations & Seeding**:
```bash
cd d:\D\kindswap\backend

# Install dependencies
npm install

# Run migrations (NestJS TypeORM)
npm run migration:run

# Seed initial data (fee configuration, tiers, etc)
npm run seed:dev

# Verify tables created
npm run db:verify
```

**Environment Configuration**:
```bash
# Create backend/.env.local
cat > .env.local << 'EOF'
# Database
DATABASE_URL=postgresql://devuser:devpass123@localhost:5432/kindswap_dev
DB_HOST=localhost
DB_PORT=5432
DB_USER=devuser
DB_PASSWORD=devpass123
DB_NAME=kindswap_dev

# Cache
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Features
ENABLE_POINTS=false
ENABLE_REWARDS=false
ENABLE_FEES=true

# Solana (testnet)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# JWT (dev keys only)
JWT_SECRET=dev-secret-key-change-in-prod
JWT_EXPIRY=24h
EOF

# Start backend in watch mode
npm run start:dev
```

**Expected Output**:
```
[Nest] 1234 - 03/23/2026, 10:30:00 AM     LOG [NestFactory] Nest application successfully started +5ms
[Nest] 1234 - 03/23/2026, 10:30:00 AM     LOG [InstanceLoader] Database connection established
[Nest] 1234 - 03/23/2026, 10:30:00 AM     LOG [RoutesResolver] SwapController {/api/swap}: routes registered +15ms
Server listening on port 3000
```

### Step 1.4: Frontend Setup

**Frontend App**:
```bash
cd d:\D\kindswap\frontend

# Install dependencies
npm install

# Start Vite dev server (auto-reload)
npm run dev

# Expected: 
# ➜  Local:   http://localhost:5173/
# ➜  Press q to quit
```

**Admin Backend**:
```bash
cd d:\D\kindswap\admin\ backend

npm install
npm run start:dev

# Runs on port 3001
```

**Admin Panel**:
```bash
cd d:\D\kindswap\admin\ panel

npm install
npm run dev

# Runs on port 5174
```

### Step 1.5: Verify All Services Running

```bash
# Terminal 1: Databases
docker-compose -f docker-compose.local.yml logs -f

# Terminal 2: Backend (http://localhost:3000)
curl http://localhost:3000/api/health

# Terminal 3: Frontend (http://localhost:5173)
# Open in browser

# Terminal 4: Admin Backend (http://localhost:3001)
curl http://localhost:3001/api/health

# Terminal 5: Admin Panel (http://localhost:5174)
# Open in browser
```

**Success Checklist**:
- ✅ PostgreSQL: Accepting connections
- ✅ Redis: PING responds PONG
- ✅ Backend API: Health check returns 200 OK
- ✅ Frontend: React app loads in browser
- ✅ Admin Backend: Accepting connections
- ✅ Admin Panel: React app loads in browser

---

## Phase 2: AWS Infrastructure (Lightweight Dev Setup)

### Step 2.1: Verify Terraform Files

**Check existing Terraform modules**:
```bash
cd d:\D\kindswap\infra\infra\infra-k8s

# Review structure
ls -la
# 01-networking/main.tf  (VPC, subnets, security groups)
# 02-security/main.tf     (IAM roles, KMS)
# 03-eks/main.tf          (EKS cluster - 1.31)
# 03-karpenter/main.tf    (Auto-scaling)
# 04-data/main.tf         (RDS PostgreSQL)
```

### Step 2.2: Create Dev-Optimized Variables

**File**: `infra/terraform.dev.tfvars`

```hcl
# Environment
environment = "dev"
region      = "us-east-1"
app_name    = "kindswap"

# Networking
vpc_cidr                 = "10.0.0.0/16"
database_subnet_cidrs    = ["10.0.21.0/24", "10.0.22.0/24"]

# EKS Configuration (MINIMAL)
eks_version              = "1.31"
eks_cluster_name         = "kindswap-dev-cluster"
eks_node_instance_types  = ["t3.small"]  # Changed from t3.medium
eks_desired_size         = 1             # Single node for dev
eks_min_size            = 1
eks_max_size            = 2              # Allow scale to 2 if needed

# RDS Configuration (DEV SPECS)
rds_instance_class      = "db.t3.micro"   # Changed from t3.medium
rds_allocated_storage   = 20               # GB
rds_multi_az            = false            # No HA needed for dev
rds_engine              = "postgres"
rds_engine_version      = "16.4"
rds_db_name             = "kindswap_dev"
rds_username            = "devadmin"
rds_password            = "DevPass123!@#"  # Change this!

# Storage
rds_backup_retention    = 7                # Keep 7 days of backups
rds_skip_final_snapshot = false            # Keep snapshot on delete for recovery

# Karpenter (optional for dev)
enable_karpenter        = false            # Use simple ASG instead
```

### Step 2.3: Prepare Terraform Backend

```bash
cd d:\D\kindswap\infra\infra

# Backend state storage (if using S3)
cat > backend.tf << 'EOF'
terraform {
  backend "s3" {
    bucket         = "kindswap-terraform-state-dev"
    key            = "infra/dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
EOF

# OR use local backend for dev (simpler)
cat > backend-local.tf << 'EOF'
terraform {
  backend "local" {
    path = "terraform.dev.tfstate"
  }
}
EOF
```

### Step 2.4: Initialize Terraform

```bash
cd d:\D\kindswap\infra\infra

# Initialize with dev backend
terraform init -backend-config="path=terraform.dev.tfstate"

# Validate configuration
terraform validate

# Expected: Success! The configuration is valid.
```

### Step 2.5: Plan and Review Changes

```bash
# Generate plan
terraform plan -var-file="terraform.dev.tfvars" -out=tfplan.dev

# Review output:
# - 1 VPC
# - 2 Subnets (database)
# - 1 RDS Instance (t3.micro)
# - 1 EKS Cluster
# - 1 EKS Node Group (1 t3.small node)
# - Security groups, IAM roles, etc

# Estimated monthly cost: $35-50
```

### Step 2.6: Apply Infrastructure (EXECUTION)

```bash
# Apply dev infrastructure
terraform apply -var-file="terraform.dev.tfvars" tfplan.dev

# Expected time: 15-20 minutes
# Monitor with: terraform show

# Capture outputs (you'll need these)
terraform output -json > infrastructure-dev.json
```

**After Completion, Capture**:
```bash
# Save these for later use
terraform output -raw rds_endpoint              # Database endpoint
terraform output -raw rds_port                  # Database port
terraform output -raw eks_cluster_name          # Cluster name
terraform output -raw eks_cluster_endpoint      # Cluster endpoint
```

---

## Phase 3: Container Builds & Scanning

### Step 3.1: Prepare Docker Images

**Backend Dockerfile** (already exists at `backend/Dockerfile`)
```bash
cd d:\D\kindswap\backend

# Build for development
docker build \
  --tag kindswap-backend:dev \
  --tag 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev \
  .

# Scan for vulnerabilities
docker scan kindswap-backend:dev
# Review security report
```

**Frontend Dockerfile** (already exists at `frontend/Dockerfile`)
```bash
cd d:\D\kindswap\frontend

docker build \
  --tag kindswap-frontend:dev \
  --tag 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-frontend:dev \
  .

docker scan kindswap-frontend:dev
```

**Admin Backend Dockerfile**:
```bash
cd d:\D\kindswap\admin\ backend

docker build \
  --tag kindswap-admin-backend:dev \
  --tag 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-backend:dev \
  .

docker scan kindswap-admin-backend:dev
```

**Admin Panel Dockerfile**:
```bash
cd d:\D\kindswap\admin\ panel

docker build \
  --tag kindswap-admin-panel:dev \
  --tag 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-panel:dev \
  .

docker scan kindswap-admin-panel:dev
```

### Step 3.2: Push to ECR

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 916994818641.dkr.ecr.us-east-1.amazonaws.com

# Create repositories if needed
aws ecr create-repository --repository-name kindswap-backend --region us-east-1
aws ecr create-repository --repository-name kindswap-frontend --region us-east-1
aws ecr create-repository --repository-name kindswap-admin-backend --region us-east-1
aws ecr create-repository --repository-name kindswap-admin-panel --region us-east-1

# Push all images
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-frontend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-backend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-panel:dev

# Verify
aws ecr describe-repositories --region us-east-1
aws ecr list-images --repository-name kindswap-backend --region us-east-1
```

### Step 3.3: Security Scanning Summary

**Scan Results Checklist**:
```bash
# After scanning all images, create a report
cat > SECURITY_SCAN_REPORT.md << 'EOF'
# Container Security Scan Report - Dev Build

## Image: kindswap-backend:dev
- Base Image: node:18-alpine
- Vulnerabilities: [CRITICAL: 0, HIGH: X, MEDIUM: Y]
- Action: [ACCEPTABLE/REMEDIATE]

## Image: kindswap-frontend:dev
- Base Image: node:18-alpine
- Vulnerabilities: [CRITICAL: 0, HIGH: X, MEDIUM: Y]
- Action: [ACCEPTABLE/REMEDIATE]

## Image: kindswap-admin-backend:dev
- Base Image: node:18-alpine
- Vulnerabilities: [CRITICAL: 0, HIGH: X, MEDIUM: Y]
- Action: [ACCEPTABLE/REMEDIATE]

## Image: kindswap-admin-panel:dev
- Base Image: node:18-alpine
- Vulnerabilities: [CRITICAL: 0, HIGH: X, MEDIUM: Y]
- Action: [ACCEPTABLE/REMEDIATE]

## Overall Status: ✅ APPROVED FOR DEV
EOF
```

---

## Phase 4: Application Deployment

### Step 4.1: Configure Database Connectivity

```bash
# Get RDS endpoint from Terraform outputs
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
RDS_PORT=$(terraform output -raw rds_port)

# Test connection
psql -h $RDS_ENDPOINT -U devadmin -d kindswap_dev -c "SELECT version();"

# Run migrations on cloud database
cd backend
DATABASE_URL="postgresql://devadmin:DevPass123!@#@$RDS_ENDPOINT:5432/kindswap_dev" \
npm run migration:run

# Seed data
DATABASE_URL="postgresql://devadmin:DevPass123!@#@$RDS_ENDPOINT:5432/kindswap_dev" \
npm run seed:dev
```

### Step 4.2: Deploy to EC2/EKS

**Option A: Simple EC2 Deployment** (recommended for dev)

```bash
# Get EC2 instance ID from Terraform outputs
INSTANCE_ID=$(terraform output -raw ec2_instance_id)

# Connect to instance
aws ec2-instance-connect open-tunnel \
  --instance-id $INSTANCE_ID \
  --region us-east-1

# Or SSH
ssh -i ~/.ssh/kindswap-dev.pem ec2-user@<public-ip>

# On the instance, create docker-compose.yml for services
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  backend:
    image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://devadmin:DevPass123!@#@$RDS_ENDPOINT:5432/kindswap_dev
      REDIS_URL: redis://localhost:6379
      NODE_ENV: development
    restart: always

  frontend:
    image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-frontend:dev
    ports:
      - "80:80"
    restart: always

  admin-backend:
    image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-backend:dev
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://devadmin:DevPass123!@#@$RDS_ENDPOINT:5432/kindswap_dev
      REDIS_URL: redis://localhost:6379
      NODE_ENV: development
    restart: always

  admin-panel:
    image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-panel:dev
    ports:
      - "5174:80"
    restart: always

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: always
EOF

# Start services
docker-compose up -d

# Verify
docker-compose ps
```

**Option B: EKS Deployment** (if using Kubernetes)

```bash
# Configure kubectl
CLUSTER_NAME=$(terraform output -raw eks_cluster_name)
aws eks update-kubeconfig --name $CLUSTER_NAME --region us-east-1

# Verify cluster access
kubectl get nodes

# Create namespace
kubectl create namespace kindswap-dev

# Deploy backend
kubectl apply -f - << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kindswap-backend
  namespace: kindswap-dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kindswap-backend
  template:
    metadata:
      labels:
        app: kindswap-backend
    spec:
      containers:
      - name: backend
        image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          value: "postgresql://devadmin:DevPass123!@#@[RDS_ENDPOINT]:5432/kindswap_dev"
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: NODE_ENV
          value: "development"
EOF

# Deploy frontend
kubectl apply -f - << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kindswap-frontend
  namespace: kindswap-dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kindswap-frontend
  template:
    metadata:
      labels:
        app: kindswap-frontend
    spec:
      containers:
      - name: frontend
        image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-frontend:dev
        ports:
        - containerPort: 80
EOF

# Expose services
kubectl expose deployment kindswap-backend -n kindswap-dev --type=LoadBalancer --port=3000
kubectl expose deployment kindswap-frontend -n kindswap-dev --type=LoadBalancer --port=80

# Get load balancer endpoints
kubectl get svc -n kindswap-dev
```

### Step 4.3: Verify Deployments

```bash
# Check EC2/Container logs
docker-compose logs -f backend
docker-compose logs -f frontend

# OR for EKS
kubectl logs -f deployment/kindswap-backend -n kindswap-dev
kubectl logs -f deployment/kindswap-frontend -n kindswap-dev

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost/  # frontend
```

---

## Phase 5: Testing & Validation

### Step 5.1: Endpoint Health Checks

```bash
#!/bin/bash
# save as: test-endpoints.sh

echo "=== Backend API Health ==="
curl -v http://localhost:3000/api/health
echo ""

echo "=== Frontend Health ==="
curl -v http://localhost/
echo ""

echo "=== Admin Backend Health ==="
curl -v http://localhost:3001/api/health
echo ""

echo "=== Database Connection ==="
psql -h $RDS_ENDPOINT -U devadmin -d kindswap_dev -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
echo ""

echo "=== Redis Connection ==="
redis-cli PING
echo ""
```

### Step 5.2: Backend Unit Tests

```bash
cd d:\D\kindswap\backend

# Run all unit tests
npm run test

# Expected output:
# PASS  src/app.controller.spec.ts
# PASS  src/swap/swap.controller.spec.ts
# ...
# Test Suites: X passed, X total
```

### Step 5.3: E2E Tests

```bash
cd d:\D\kindswap\backend

# Run E2E tests
npm run test:e2e

# Tests include:
# ✅ GET /api/health -> 200 OK
# ✅ GET /api/config/fee-config -> 200 OK with payload
# ✅ GET /api/config/fee-tiers -> 200 OK with array
# ✅ POST /api/swap/complete -> 201 Created
# ✅ Database operations (migrations, queries)
# ✅ Redis operations (cache get/set)
```

### Step 5.4: Integration Tests

**Swap Transaction Flow**:
```bash
cat > test-swap-flow.sh << 'EOF'
#!/bin/bash

echo "1. Get current fee configuration"
curl -X GET http://localhost:3000/api/config/fee-config | jq '.'

echo "2. Get available fee tiers"
curl -X GET http://localhost:3000/api/config/fee-tiers | jq '.'

echo "3. Log a swap transaction"
curl -X POST http://localhost:3000/api/swap/complete \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "2vCzMU4UvDhPjx5j1TvYyJAGFnxXZiJKBVhGLSNJTb7N",
    "signature": "5dXa1J6XkL2ZpQmN8kRvB3nL5mJ9sT4wY7cH2pQ6rS8tU9vW0xL1mN2oP3qR4sTu5vWxYyZaAbBcCdDeEfFgGhHiIjJkK",
    "status": "confirmed",
    "inputAmountUSD": 100.00,
    "outputAmountUSD": 99.50,
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5Au57nrzEpvvSxPVxnzj4CwX8phQyh3Ty3KYa",
    "inputAmount": "1000000000",
    "outputAmount": "995000000",
    "inputDecimals": 9,
    "outputDecimals": 6
  }' | jq '.'

echo "4. Query swap history"
curl -X GET "http://localhost:3000/api/swap/history?wallet=2vCzMU4UvDhPjx5j1TvYyJAGFnxXZiJKBVhGLSNJTb7N&limit=10" | jq '.'
EOF

chmod +x test-swap-flow.sh
./test-swap-flow.sh
```

### Step 5.5: Frontend Manual Testing

```bash
# Frontend: http://localhost:5173 (or deployed URL)
# Test cases:
# 1. Load homepage
# 2. Connect wallet (Solana Phantom)
# 3. Initiate swap
# 4. Verify transaction logging
# 5. Check user points/rewards (if enabled)

# Admin Panel: http://localhost:5174 (or deployed URL)
# Test cases:
# 1. Login with admin credentials
# 2. View fee configuration
# 3. Update fee tiers
# 4. View transaction history
# 5. Generate reports
```

### Step 5.6: Performance & Load Testing (Optional)

```bash
# Install load testing tool
npm install -g autocannon

# Test backend under load
autocannon \
  --connections=10 \
  --pipelining=1 \
  --duration=30 \
  http://localhost:3000/api/health

# Results: Requests/sec, latency, throughput
```

---

## Cost Breakdown

### Monthly AWS Costs (Development)

| Service | Instance Type | Monthly Cost | Notes |
|---------|---------------|-------------|-------|
| RDS | db.t3.micro (single-AZ) | ~$15 | 20GB storage included |
| EC2 Backend | t3.small (on-demand) | ~$9 | 730 hrs/month |
| EC2 Frontend | t3.small (on-demand) | ~$9 | 730 hrs/month |
| NAT Gateway | Hourly + data transfer | ~$5 | Minimal usage |
| Data Transfer | Egress | ~$2 | <5GB/month |
| **Total Estimated** | | **~$40/month** | 90% cheaper than prod |

### Cost Optimization Tips

```bash
# 1. Use reserved capacity (60% discount)
aws ec2 purchase-reserved-instances \
  --instance-type t3.small \
  --availability-zone us-east-1a \
  --term-years 1

# 2. Stop instances when not in use
aws ec2 stop-instances --instance-ids i-xxxxx

# 3. Use spot instances for non-critical workloads
# In Terraform, set: instance_type = "t3.small" and use spot pricing

# 4. Monitor with AWS Cost Explorer
# AWS Console → Cost Explorer → Filter by environment=dev
```

---

## Troubleshooting

### Issue: Database Connection Failed

```bash
# 1. Verify RDS is running
aws rds describe-db-instances --region us-east-1 | grep "DBInstanceStatus"

# 2. Check security group allows inbound on port 5432
aws ec2 describe-security-groups --region us-east-1 | jq '.SecurityGroups[] | select(.GroupName=="rds-dev-sg")'

# 3. Test connection directly
psql -h <RDS_ENDPOINT> -U devadmin -d kindswap_dev -c "SELECT 1"

# 4. Check subnet routing
aws ec2 describe-route-tables --region us-east-1
```

### Issue: EKS Pods Won't Start

```bash
# 1. Check pod status
kubectl get pods -n kindswap-dev -o wide

# 2. View pod logs
kubectl logs -f pod/kindswap-backend-xxxxx -n kindswap-dev

# 3. Check node capacity
kubectl top nodes

# 4. Check ECR image pull permissions
kubectl describe pod kindswap-backend-xxxxx -n kindswap-dev

# 5. Fix: Ensure node has IAM role to pull from ECR
# Review: infra/02-security/main.tf → eks-node-role policy
```

### Issue: High RDS Latency

```bash
# 1. Check instance metrics
aws cloudwatch get-metric-statistics \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=kindswap-dev \
  --start-time 2026-03-23T00:00:00Z \
  --end-time 2026-03-23T23:59:59Z \
  --period 300 \
  --statistics Average

# 2. Upgrade if needed (t3.small instance)
aws rds modify-db-instance \
  --db-instance-identifier kindswap-dev \
  --db-instance-class db.t3.small \
  --apply-immediately
```

### Issue: Docker Build Fails

```bash
# 1. Clear Docker cache
docker system prune -a

# 2. Build with verbose output
docker build --no-cache --progress=plain -t kindswap-backend:dev .

# 3. Check for missing dependencies
npm install
npm list

# 4. Check node version
node --version  # Should be 18+
```

---

## Success Criteria

✅ **All of these must be true**:

1. **Local Development**
   - [ ] PostgreSQL and Redis running in Docker
   - [ ] Backend listening on :3000
   - [ ] Frontend accessible at http://localhost:5173
   - [ ] Admin Backend listening on :3001
   - [ ] Admin Panel accessible at http://localhost:5174

2. **AWS Infrastructure**
   - [ ] RDS instance created and accessible
   - [ ] EC2 instances running (or EKS cluster healthy)
   - [ ] ECR repositories contain all 4 images
   - [ ] VPC and networking configured

3. **Containerization**
   - [ ] All 4 Docker images build successfully
   - [ ] Security scans pass (no CRITICAL vulnerabilities)
   - [ ] Images pushed to ECR

4. **Deployment**
   - [ ] Containers deployed to EC2/EKS
   - [ ] Health checks return 200 OK
   - [ ] Database migrations completed
   - [ ] Seed data loaded

5. **Testing**
   - [ ] All unit tests pass (`npm run test`)
   - [ ] E2E tests pass (`npm run test:e2e`)
   - [ ] API endpoints respond correctly
   - [ ] Database operations work
   - [ ] Redis cache works
   - [ ] Frontend loads without errors
   - [ ] Admin panel loads without errors

6. **Validation**
   - [ ] Swap transaction logging works end-to-end
   - [ ] Fee configuration retrievable
   - [ ] No console errors in frontend
   - [ ] Database connections pooled correctly
   - [ ] Logs available for debugging

---

## Next Steps After Setup

1. **Development Workflow**
   - Create feature branches from `dev`
   - Run tests locally before pushing
   - Use Pull Requests for code review

2. **Continuous Integration**
   - Set up GitHub Actions for auto-testing on PR
   - Auto-build and push to ECR on merge
   - Auto-deploy to dev environment

3. **Monitoring**
   - Set up CloudWatch dashboards
   - Configure SNS alerts for failures
   - Enable RDS Performance Insights

4. **Documentation**
   - Update API docs with real endpoints
   - Document any custom configurations
   - Create runbooks for common tasks

---

## Quick Reference Commands

```bash
# LOCAL
docker-compose -f docker-compose.local.yml up -d
npm run start:dev  # backend
npm run dev        # frontend

# AWS
terraform plan -var-file="terraform.dev.tfvars"
terraform apply -var-file="terraform.dev.tfvars"

# CONTAINERS
docker build -t kindswap-backend:dev .
docker scan kindswap-backend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev

# TESTING
npm run test
npm run test:e2e
curl http://localhost:3000/api/health

# DATABASE
psql -h $RDS_ENDPOINT -U devadmin -d kindswap_dev
DATABASE_URL="..." npm run migration:run

# LOGS
docker-compose logs -f
kubectl logs -f deployment/kindswap-backend -n kindswap-dev
aws logs tail /aws/lambda/kindswap-dev
```

---

**Last Updated**: March 23, 2026  
**Status**: Ready for Execution  
**Estimated Total Time**: 2-3 hours  
**Support**: See Troubleshooting section or contact DevOps team
