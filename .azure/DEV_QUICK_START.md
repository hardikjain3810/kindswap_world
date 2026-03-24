# 🚀 KindSwap Dev Setup - Quick Start Checklist

**Prepared**: March 23, 2026  
**Main Plan**: `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md`  
**Estimated Time**: 2-3 hours  
**Total Cost**: ~$40/month (all 4 services running)

---

## 📌 What's Running in Dev?

| Component | Technology | Port | Why |
|-----------|-----------|------|-----|
| **Backend API** | NestJS + PostgreSQL | 3000 | Main swap/transaction processor |
| **Frontend Web** | React + Vite | 5173 | User trading interface |
| **Admin Backend** | NestJS + PostgreSQL | 3001 | Admin management API |
| **Admin Panel** | React + Vite | 5174 | Fee config & monitoring UI |

**Database**: Fresh PostgreSQL (no restore)  
**Cache**: Redis for session/cache  
**Infrastructure**: Minimal AWS (t3.micro RDS, t3.small EC2)

---

## ⚡ Quick Start (5 min overview)

### What You'll Do
1. **Phase 1** (30 min): Spin up local Docker containers (postgres + redis)
2. **Phase 2** (20 min): Setup Terraform and AWS infrastructure
3. **Phase 3** (30 min): Build Docker images and push to ECR
4. **Phase 4** (20 min): Deploy containers to EC2/EKS
5. **Phase 5** (30 min): Run full test suite

### How to Execute
```bash
# Start with Phase 1: Local development
cd d:\D\kindswap

# Follow sections in order from the main plan:
# 📄 .azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md
```

---

## ✅ Phase 1: Local Development (START HERE)

### 1.1 Start Docker Services
```bash
cd d:\D\kindswap
docker-compose -f docker-compose.local.yml up -d
docker ps  # Verify postgres + redis running
```

### 1.2 Backend Setup
```bash
cd backend
npm install
npm run migration:run
npm run start:dev  # Should see: Nest application successfully started
```

### 1.3 Frontend Setup
```bash
cd d:\D\kindswap/frontend
npm install
npm run dev  # Open http://localhost:5173
```

### 1.4 Admin Backend
```bash
cd d:\D\kindswap/admin\ backend
npm install
npm run start:dev  # Port 3001
```

### 1.5 Admin Panel
```bash
cd d:\D\kindswap/admin\ panel
npm install
npm run dev  # Port 5174
```

### 1.6 Verify All Running
```bash
# Backend health
curl http://localhost:3000/api/health
# Should return: {"status":"ok",...}

# Frontend
open http://localhost:5173  # Should load React app

# Admin Backend
curl http://localhost:3001/api/health

# Admin Panel
open http://localhost:5174  # Should load React app
```

**✅ Phase 1 Complete when**: All 4 services respond + no console errors

---

## ⚙️ Phase 2: AWS Infrastructure

### 2.1 Review Terraform Config
```bash
cd d:\D\kindswap\infra\infra
ls -la infra-k8s/*/main.tf  # Verify files exist
```

### 2.2 Create Dev Variables
Create `terraform.dev.tfvars`:
```hcl
environment = "dev"
region = "us-east-1"
eks_node_instance_types = ["t3.small"]
eks_desired_size = 1
rds_instance_class = "db.t3.micro"
rds_multi_az = false
```

### 2.3 Terraform Apply
```bash
terraform init
terraform plan -var-file="terraform.dev.tfvars" -out=tfplan.dev
terraform apply tfplan.dev

# Wait 15-20 min for infrastructure to be ready
# Save outputs:
terraform output -raw rds_endpoint
terraform output -raw eks_cluster_name
```

**✅ Phase 2 Complete when**: All resources created, RDS accessible

---

## 🐳 Phase 3: Container Builds & Security

### 3.1 Build All Images
```bash
# Backend
cd d:\D\kindswap\backend
docker build -t kindswap-backend:dev .
docker scan kindswap-backend:dev  # Check vulnerabilities

# Frontend
cd d:\D\kindswap\frontend
docker build -t kindswap-frontend:dev .
docker scan kindswap-frontend:dev

# Admin Backend
cd d:\D\kindswap\admin\ backend
docker build -t kindswap-admin-backend:dev .
docker scan kindswap-admin-backend:dev

# Admin Panel
cd d:\D\kindswap\admin\ panel
docker build -t kindswap-admin-panel:dev .
docker scan kindswap-admin-panel:dev
```

### 3.2 Tag for ECR
```bash
docker tag kindswap-backend:dev 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev
docker tag kindswap-frontend:dev 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-frontend:dev
docker tag kindswap-admin-backend:dev 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-backend:dev
docker tag kindswap-admin-panel:dev 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-panel:dev
```

### 3.3 Push to ECR
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 916994818641.dkr.ecr.us-east-1.amazonaws.com

docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-frontend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-backend:dev
docker push 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-admin-panel:dev
```

**✅ Phase 3 Complete when**: All 4 images in ECR, scan reports acceptable

---

## 🚢 Phase 4: Deploy to AWS

### 4.1 Configure Database
```bash
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
psql -h $RDS_ENDPOINT -U devadmin -d kindswap_dev -c "SELECT 1"

cd d:\D\kindswap\backend
DATABASE_URL="postgresql://devadmin:DevPass123!@#@$RDS_ENDPOINT:5432/kindswap_dev" npm run migration:run
DATABASE_URL="postgresql://devadmin:DevPass123!@#@$RDS_ENDPOINT:5432/kindswap_dev" npm run seed:dev
```

### 4.2 Deploy to EC2 or EKS
**Option A: EC2 (simpler)**
- Create docker-compose.yml on EC2 instance
- Pull images from ECR
- docker-compose up -d

**Option B: EKS**
- kubectl apply deployments
- Configure load balancers
- Expose services

See section 4.2 in main plan for detailed steps.

**✅ Phase 4 Complete when**: Containers running, health checks pass

---

## 🧪 Phase 5: Test Everything

### 5.1 Health Checks
```bash
curl http://localhost:3000/api/health      # Backend
curl http://localhost:3001/api/health      # Admin Backend
curl http://localhost/                      # Frontend (if deployed)
```

### 5.2 Run Test Suite
```bash
cd d:\D\kindswap\backend

npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
```

### 5.3 Integration Test (Swap Flow)
```bash
# Get fee config
curl http://localhost:3000/api/config/fee-config

# Log a swap
curl -X POST http://localhost:3000/api/swap/complete \
  -H "Content-Type: application/json" \
  -d '{"wallet":"...", "signature":"...", "status":"confirmed",...}'

# Query history
curl http://localhost:3000/api/swap/history
```

### 5.4 Manual Testing
- Open http://localhost:5173 → Test swap flow
- Open http://localhost:5174 → Test admin panel
- Check database: `psql ... -c "SELECT * FROM swap_transactions LIMIT 5;"`
- Check Redis: `redis-cli PING`

**✅ Phase 5 Complete when**: All tests pass, no errors in logs

---

## 📊 Success Criteria (All Must Be ✅)

### Local Development
- [ ] PostgreSQL running in Docker
- [ ] Redis running in Docker
- [ ] Backend listening on :3000
- [ ] Frontend accessible at http://localhost:5173
- [ ] Admin Backend listening on :3001
- [ ] Admin Panel accessible at http://localhost:5174

### AWS Infrastructure  
- [ ] RDS instance created (db.t3.micro)
- [ ] EC2 instance running (t3.small) OR EKS cluster healthy
- [ ] ECR repositories created
- [ ] VPC and security groups configured

### Containers
- [ ] 4 Docker images built successfully
- [ ] Security scans pass (no CRITICAL vulnerabilities)
- [ ] All images pushed to ECR

### Deployment
- [ ] Containers pulled and running
- [ ] Health endpoints return 200 OK
- [ ] Database migrations completed
- [ ] Seed data loaded

### Testing
- [ ] Unit tests pass: `npm run test`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] API endpoints respond correctly
- [ ] Database operations work
- [ ] Redis cache works
- [ ] Swap flow works end-to-end
- [ ] No console errors in frontend

---

## 🔧 Troubleshooting Quick Links

**Issue** → See section in main plan
- Database won't connect → Troubleshooting → Database Connection Failed
- Pods won't start → Troubleshooting → EKS Pods Won't Start
- High RDS latency → Troubleshooting → High RDS Latency
- Docker build fails → Troubleshooting → Docker Build Fails

---

## 💰 Cost Tracking

```bash
# Monthly AWS Cost
RDS (t3.micro):        ~$15
EC2 Backend (t3.small): ~$9
EC2 Frontend (t3.small):~$9
NAT Gateway:           ~$5
Data Transfer:         ~$2
TOTAL:                 ~$40/month

# Stop to save money
aws ec2 stop-instances --instance-ids i-xxxxx
aws rds stop-db-instance --db-instance-identifier kindswap-dev
```

---

## 📋 Detailed Plan

**Full documentation**: `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md`

Contains:
- ✅ Phase-by-phase detailed instructions
- ✅ All code examples and commands
- ✅ Architecture diagrams
- ✅ Security scanning procedures
- ✅ Load testing setup
- ✅ Monitoring configuration
- ✅ Performance optimization
- ✅ Cost breakdown and optimization tips
- ✅ Comprehensive troubleshooting guide

---

## 🎯 Current Status

**✅ READY TO EXECUTE**

- All AWS resources deleted (saved $0 overnight cost)
- Terraform modules verified and ready
- Docker files exist and build
- Local environment setup documented
- Testing suite prepared
- Security scanning integrated
- Cost optimized for development

**Next Action**: Start Phase 1 (Local Development) from the quick start above

---

## 📞 Support

- **Questions?** Review the detailed plan: `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md`
- **Stuck?** Jump to Troubleshooting section
- **Cost concerns?** See cost optimization tips in Phase 2

---

**Status**: 🟢 Ready for Development  
**Last Updated**: March 23, 2026  
**Prepared By**: GitHub Copilot  
**Execution Time**: 2-3 hours total
