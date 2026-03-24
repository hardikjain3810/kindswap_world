# KindSwap Dev - One-Page Reference Card

**Print this or keep open while working**

---

## 🚀 START HERE

```bash
# Terminal 1: Start databases (5 min)
cd d:\D\kindswap
docker-compose -f docker-compose.local.yml up -d
docker ps  # ✅ postgres + redis running?

# Terminal 2: Backend API (5 min)
cd d:\D\kindswap\backend
cp .env.local.example .env.local
npm install && npm run start:dev
# Wait for: "Nest application successfully started"
# Health: curl http://localhost:3000/api/health

# Terminal 3: Frontend UI (5 min)
cd d:\D\kindswap\frontend
npm install && npm run dev
# Open: http://localhost:5173

# Terminal 4: Admin Backend (5 min)
cd d:\D\kindswap\admin\ backend
npm install && npm run start:dev
# Health: curl http://localhost:3001/api/health

# Terminal 5: Admin Panel (5 min)
cd d:\D\kindswap\admin\ panel
npm install && npm run dev
# Open: http://localhost:5174
```

---

## 📋 Services Health Check

```
✅ Database    → psql -h localhost -U devuser -d kindswap_dev -c "SELECT 1"
✅ Cache       → redis-cli PING
✅ Backend     → curl http://localhost:3000/api/health
✅ Admin API   → curl http://localhost:3001/api/health
✅ Frontend    → http://localhost:5173
✅ Admin Panel → http://localhost:5174
```

---

## 🧪 Testing

```bash
cd d:\D\kindswap\backend

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Integration test (swap flow)
curl -X POST http://localhost:3000/api/swap/complete \
  -H "Content-Type: application/json" \
  -d '{"wallet":"2vCzMU4...", "signature":"5dXa1J...", "status":"confirmed"}'

# Check results
curl http://localhost:3000/api/swap/history
```

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f postgres
docker-compose -f docker-compose.local.yml logs -f redis

# Stop all
docker-compose -f docker-compose.local.yml down

# Restart one service
docker-compose -f docker-compose.local.yml restart postgres

# Check status
docker ps
docker-compose -f docker-compose.local.yml ps
```

---

## 📊 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| `Port 5432 already in use` | `docker-compose down` then `docker-compose up -d` |
| `npm: command not found` | Install Node.js 18+: `node --version` |
| `Cannot connect to database` | Wait 30s for postgres to start, check `docker logs kindswap-postgres-dev` |
| `Database does not exist` | Run `npm run migration:run` from backend folder |
| `Frontend shows blank page` | Check console: `F12 → Console` for errors, `npm run dev` logs |
| `Redis connection refused` | `redis-cli PING` should respond `PONG`, restart if needed |
| `Migrations not running` | `DATABASE_URL=... npm run migration:run` |

---

## 🔧 Environment Setup

**Backend**: Copy `.env.local.example` to `.env.local`
```bash
cp backend/.env.local.example backend/.env.local
```

**Key variables** (usually already set):
```
DATABASE_URL=postgresql://devuser:devpass123@localhost:5432/kindswap_dev
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
```

---

## 📁 Project Structure

```
d:\D\kindswap\
├─ backend/               → NestJS API (port 3000)
├─ frontend/             → React UI (port 5173)
├─ admin\ backend/       → Admin API (port 3001)
├─ admin\ panel/         → Admin UI (port 5174)
├─ docker-compose.local.yml → PostgreSQL + Redis
└─ .azure/
   ├─ DEV_ENVIRONMENT_COMPLETE_PLAN.md → Full guide
   ├─ DEV_QUICK_START.md → Checklist
   └─ EXECUTION_SUMMARY.md → Status
```

---

## 🎯 Development Workflow

```bash
# 1. Make code changes
vim backend/src/app.controller.ts

# 2. Services auto-reload (thanks to npm run start:dev)
# Watch logs for errors

# 3. Test locally
npm run test

# 4. Git commit & push
git add .
git commit -m "feature: description"
git push origin feature/my-feature

# 5. Create pull request & wait for CI/CD
# (Your changes will auto-test & deploy to dev AWS)
```

---

## 💻 Database Access

### CLI (psql)
```bash
# Local
psql -h localhost -U devuser -d kindswap_dev

# AWS (once deployed)
psql -h <RDS_ENDPOINT> -U devadmin -d kindswap_dev
```

### GUI (pgAdmin)
```
Browser: http://localhost:5050
Email: admin@kindswap.dev
Password: admin
Server: postgres:5432
```

### Common Queries
```sql
-- Check tables created
\dt

-- Check swap transactions
SELECT COUNT(*) FROM swap_transactions;

-- Check fee configuration
SELECT * FROM fee_configuration;

-- Check fee tiers
SELECT * FROM fee_tiers;
```

---

## 📊 API Endpoints (Backend)

```
GET  http://localhost:3000/api/health
GET  http://localhost:3000/api/config/fee-config
GET  http://localhost:3000/api/config/fee-tiers
POST http://localhost:3000/api/swap/complete
GET  http://localhost:3000/api/swap/history?wallet=<addr>
```

**Admin** (port 3001 same endpoints)

---

## 🚀 Deploy to AWS (After Phase 1)

```bash
# 1. Build container
docker build -t kindswap-backend:dev .

# 2. Scan for vulnerabilities
docker scan kindswap-backend:dev

# 3. Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  916994818641.dkr.ecr.us-east-1.amazonaws.com

# 4. Push to ECR
docker tag kindswap-backend:dev \
  916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev
docker push \
  916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:dev

# 5. Infrastructure (Terraform)
cd infra/infra
terraform apply -var-file="terraform.dev.tfvars"
```

---

## 📞 Get Help

| Problem | Look Here |
|---------|-----------|
| Full setup guide | `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md` |
| Quick checklist | `.azure/DEV_QUICK_START.md` |
| Status overview | `.azure/EXECUTION_SUMMARY.md` |
| Troubleshooting | `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md` → Troubleshooting section |
| Architecture | `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md` → Phase 0 |

---

## 💰 Cost Tracking

**Local**: $0/month (your laptop)

**AWS Dev** (optional cloud setup):
- RDS (t3.micro): ~$15/month
- EC2 backend (t3.small): ~$9/month
- EC2 frontend (t3.small): ~$9/month
- Other: ~$5/month
- **TOTAL: ~$40/month**

---

## ✅ Success Checklist

- [ ] All 4 services running locally
- [ ] Health endpoints return 200 OK
- [ ] Frontend loads without errors
- [ ] Database connections working
- [ ] Redis PING responds
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] No console errors in browser

---

## 🎯 Key Takeaways

1. **Phase 1** (Local): 45 min to get all services running
2. **Phase 2** (AWS): 20 min to set up cloud infrastructure
3. **Phase 3** (Containers): 30 min to build & secure images
4. **Phase 4** (Deploy): 15 min to push to cloud
5. **Phase 5** (Test): 20 min to validate everything

**TOTAL: 2-3 hours** from zero to production-ready dev environment

---

## 🔐 Security Reminders

- ✅ `.env.local` is gitignored (don't commit secrets)
- ✅ Development passwords in config (change in production)
- ✅ Docker scans for vulnerabilities
- ✅ Database in private subnet (AWS)
- ✅ Use HTTPS in production

---

## 📝 Save This Reference

Print or bookmark:
- **Local commands**: This card (top section)
- **Setup details**: `.azure/DEV_QUICK_START.md`
- **Everything**: `.azure/DEV_ENVIRONMENT_COMPLETE_PLAN.md`

---

**Status**: 🟢 Ready  
**Last Updated**: March 23, 2026  
**Time to First Deploy**: ~1 hour (local only)  
**Time to Full Setup**: 2-3 hours
