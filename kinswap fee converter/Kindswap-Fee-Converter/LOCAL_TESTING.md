# Local Lambda Testing Guide

This guide explains how to test Lambda functions locally **without deploying to AWS**.

## Overview

For local development, you have **three options**:

1. **Development HTTP Server** (Current Setup) - Health checks and monitoring
2. **Local Lambda Invocation** (This Guide) - Test individual Lambda functions
3. **Docker Container Testing** - Run functions inside Docker

---

## Option 1: Development HTTP Server ✅ (Already Working)

The HTTP server is running on port 3000 with health checks:

```bash
# Check health status
curl http://localhost:3000/health

# Get application info
curl http://localhost:3000/info

# List Lambda functions
curl http://localhost:3000/lambdas
```

**What it shows:**
- Database connection status
- LocalStack connection status
- Available Lambda functions
- Environment information

---

## Option 2: Local Lambda Invocation (Using Serverless Framework)

### Why This Exists

The main `serverless.yml` is configured for **AWS deployment** with:
- SSM parameter store references
- VPC configuration
- AWS credentials required

For **local testing**, use `serverless.local.yml` which:
- Uses local environment variables
- Points to Docker services (postgres, localstack)
- No AWS credentials needed

### Quick Start

```bash
# Test Fee Indexer
npm run lambda:fee-indexer

# Test Conversion Planner
npm run lambda:conversion-planner

# Test Conversion Executor
npm run lambda:conversion-executor

# Test USDC Distributor
npm run lambda:usdc-distributor
```

### What You'll See

Each Lambda function will:
1. Load the event from `events/<function>-event.json`
2. Execute the handler with local environment variables
3. Log output to console
4. Return the result

**Expected Output:**
```
info: Fee Indexer started {
  requestId: 'local-invocation-id',
  eventTime: '2026-03-12T08:00:00Z'
}

info: Fee Indexer completed {
  success: true,
  processed: 0,
  skipped: 0,
  errors: 0,
  timestamp: '2026-03-12T08:35:00.000Z'
}
```

---

## Option 3: Docker Container Testing

### Inside Docker Container

```bash
# Enter the container
docker exec -it fee-converter-app bash

# Run Lambda tests inside container
npm run lambda:fee-indexer
npm run lambda:conversion-planner
npm run lambda:conversion-executor
npm run lambda:usdc-distributor

# Exit
exit
```

### Build & Test Cycle

```bash
# 1. Build TypeScript
docker exec fee-converter-app npm run build

# 2. Test a function
docker exec fee-converter-app npm run lambda:fee-indexer

# 3. Check logs
docker logs fee-converter-app --tail 50
```

---

## Custom Event Testing

### Modify Event Data

Edit the event files in `events/` directory:

- `events/fee-indexer-event.json` - Scheduled event for fee indexing
- `events/conversion-planner-event.json` - Scheduled event for planning
- `events/conversion-executor-event.json` - SQS message for execution
- `events/usdc-distributor-event.json` - Scheduled event for distribution

### Example: Test with Custom SQS Message

Edit `events/conversion-executor-event.json`:

```json
{
  "Records": [
    {
      "messageId": "custom-test-message",
      "body": "{\"jobId\":\"job-456\",\"tokenMint\":\"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\",\"amount\":50000000,\"priority\":\"high\"}",
      ...
    }
  ]
}
```

Then run:
```bash
npm run lambda:conversion-executor
```

---

## Environment Variables

### Local Configuration

The `serverless.local.yml` uses these environment variables:

```yaml
DB_HOST: postgres                 # Docker service name
DB_PORT: 5432
DB_NAME: kindsoul_fee_conversion
DB_USER: postgres
DB_PASSWORD: postgres_local_password
AWS_ENDPOINT: http://localstack:4566
HELIUS_API_KEY: ${env:HELIUS_API_KEY, 'test-api-key'}
```

### Override with .env

Create a `.env.local` file:

```bash
HELIUS_API_KEY=your_real_api_key
OPS_WALLET_ADDRESS=YourWalletAddress123...
```

Then load it:
```bash
source .env.local
npm run lambda:fee-indexer
```

---

## Testing Workflow

### 1. Test Individual Lambda

```bash
# Test one function at a time
npm run lambda:fee-indexer
```

### 2. Test All Functions

```bash
# Run all Lambda tests sequentially
npm run lambda:fee-indexer && \
npm run lambda:conversion-planner && \
npm run lambda:conversion-executor && \
npm run lambda:usdc-distributor
```

### 3. Test with Database

```bash
# 1. Ensure database is running
docker ps | grep fee-converter-db

# 2. Run migrations (if not done)
# docker exec fee-converter-app npm run migrate:up

# 3. Test function that uses database
npm run lambda:fee-indexer

# 4. Check database for results
docker exec -it fee-converter-db psql -U postgres -d kindsoul_fee_conversion -c "SELECT * FROM fee_ledger LIMIT 10;"
```

---

## Debugging

### Enable Debug Logging

Set `LOG_LEVEL=debug` in your environment:

```bash
export LOG_LEVEL=debug
npm run lambda:fee-indexer
```

### Watch Container Logs

In a separate terminal:
```bash
# Watch all logs
docker-compose logs -f

# Watch just the app
docker-compose logs -f app
```

### TypeScript Build Errors

If you encounter TypeScript errors:

```bash
# Check for errors
docker exec fee-converter-app npm run type-check

# Build the code
docker exec fee-converter-app npm run build

# Fix linting
docker exec fee-converter-app npm run lint:fix
```

---

## Common Issues

### Issue: "Cannot find module '@shared/...'"

**Solution:** Build TypeScript first
```bash
docker exec fee-converter-app npm run build
```

### Issue: "Database connection failed"

**Solution:** Check if database is running
```bash
docker ps | grep fee-converter-db
curl http://localhost:3000/health
```

### Issue: "AWS credentials missing"

**Solution:** You're using the wrong config file. Use `serverless.local.yml`:
```bash
# ❌ Wrong - tries to deploy to AWS
serverless deploy

# ✅ Correct - tests locally
npm run lambda:fee-indexer
```

### Issue: "LocalStack not responding"

**Solution:** Check LocalStack health
```bash
docker logs fee-converter-localstack --tail 50
curl http://localhost:4566/_localstack/health
```

---

## Comparison: serverless.yml vs serverless.local.yml

| Feature | serverless.yml | serverless.local.yml |
|---------|----------------|---------------------|
| **Purpose** | AWS deployment | Local testing |
| **Credentials** | AWS required | None required |
| **Environment** | SSM parameters | Local variables |
| **VPC** | AWS VPC config | Not needed |
| **Database** | RDS endpoint | Docker postgres |
| **AWS Services** | Real AWS | LocalStack mock |
| **Usage** | `serverless deploy` | `serverless invoke local --config serverless.local.yml` |

---

## Next Steps

1. **Implement Business Logic** - Lambda functions currently have TODO placeholders
2. **Add Integration Tests** - Test Lambda functions with database and LocalStack
3. **Create Database Migrations** - Set up tables for the application
4. **Add Monitoring** - CloudWatch-style logging for Lambda functions

---

## Quick Reference

```bash
# Development server (already running)
curl http://localhost:3000/health

# Test individual Lambda functions
npm run lambda:fee-indexer
npm run lambda:conversion-planner
npm run lambda:conversion-executor
npm run lambda:usdc-distributor

# Inside Docker container
docker exec fee-converter-app npm run build
docker exec fee-converter-app npm run lambda:fee-indexer

# Database access
docker exec -it fee-converter-db psql -U postgres -d kindsoul_fee_conversion

# LocalStack check
curl http://localhost:4566/_localstack/health

# View logs
docker logs -f fee-converter-app
docker-compose logs -f
```

---

## Support

For issues:
- Check [README.md](./README.md) for general setup
- Check [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed guide
- Open an issue on GitHub
