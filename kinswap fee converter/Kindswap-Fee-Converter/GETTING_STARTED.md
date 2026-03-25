# Getting Started with Lambda Fee Converter

Quick start guide to get the project up and running in 5 minutes.

## Prerequisites

Make sure you have the following installed:

- ✅ Node.js 20.x or higher ([Download](https://nodejs.org/))
- ✅ npm 10.x or higher (comes with Node.js)
- ✅ Docker Desktop ([Download](https://www.docker.com/products/docker-desktop))
- ✅ Git

## Quick Setup (5 Minutes)

### Step 1: Clone and Install (1 min)

```bash
# Clone the repository
git clone <your-repo-url>
cd lambda-fee-converter

# Install dependencies
npm install
```

### Step 2: Environment Setup (1 min)

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your configuration
# At minimum, set:
# - HELIUS_API_KEY (get from https://helius.dev)
# - OPS_WALLET_ADDRESS (your Solana wallet)
```

### Step 3: Start Services with Docker (2 min)

```bash
# Start all services (PostgreSQL, LocalStack, App, Redis)
docker-compose up -d

# Check if all services are running
docker-compose ps
```

Expected output:
```
NAME                      STATUS
fee-converter-app         running
fee-converter-db          healthy
fee-converter-localstack  healthy
fee-converter-redis       healthy
```

### Step 4: Setup Database (1 min)

```bash
# Run database migrations
npm run migrate:up

# Seed initial policy data
npm run seed:policy
```

### Step 5: Verify Installation

```bash
# Run tests to verify everything is working
npm test

# Check if the app is running
curl http://localhost:3000
```

## What's Running?

After running `docker-compose up`, you'll have:

| Service | URL | Purpose |
|---------|-----|---------|
| **Application** | http://localhost:3000 | Main Lambda fee converter app |
| **PostgreSQL** | localhost:5432 | Database with TimescaleDB |
| **LocalStack** | http://localhost:4566 | Local AWS services (SQS, KMS, etc.) |
| **Redis** | localhost:6379 | Caching layer |
| **PgAdmin** | http://localhost:5050 | Database admin UI (optional) |

### PgAdmin Access (Optional)

If you want to view/manage the database:

```bash
# Start PgAdmin service
docker-compose --profile tools up -d pgadmin

# Open browser: http://localhost:5050
# Login: admin@kindsoul.com / admin

# Add server connection:
# Host: postgres
# Port: 5432
# Database: kindsoul_fee_conversion
# Username: postgres
# Password: postgres_local_password
```

## Development Workflow

### Option 1: Using Make (Recommended)

```bash
# View all available commands
make help

# Start development
make dev

# Run tests
make test

# Lint and format code
make quality

# Deploy to dev environment
make deploy-dev
```

### Option 2: Using npm Scripts

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build:prod

# Deploy to dev
npm run deploy:dev
```

### Option 3: Using Docker Only

```bash
# All services in Docker
docker-compose up -d

# View logs
docker-compose logs -f app

# Run commands inside container
docker-compose exec app npm test
docker-compose exec app npm run migrate:up

# Stop all services
docker-compose down
```

## Useful Commands

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm test -- --coverage

# Run only integration tests
npm run test:integration
```

### Code Quality

```bash
# Check code quality (lint + type-check)
npm run lint
npm run type-check

# Auto-fix issues
npm run lint:fix
npm run format

# Run all quality checks at once
make quality
```

### Database

```bash
# Run migrations (create tables)
npm run migrate:up

# Rollback migrations
npm run migrate:down

# Seed initial data
npm run seed:policy

# Connect to database via CLI
docker-compose exec postgres psql -U postgres -d kindsoul_fee_conversion
```

### Docker Management

```bash
# Start all services
docker-compose up -d

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f app

# Restart a service
docker-compose restart app

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild containers
docker-compose up -d --build
```

## Project Structure Overview

```
lambda-fee-converter/
├── src/
│   ├── functions/          # Lambda handlers (4 functions)
│   │   ├── fee-indexer/
│   │   ├── conversion-planner/
│   │   ├── conversion-executor/
│   │   └── usdc-distributor/
│   ├── shared/             # Shared code
│   │   ├── db/            # Database utilities
│   │   ├── utils/         # Helper functions
│   │   └── clients/       # API clients
│   └── types/             # TypeScript types
├── tests/                  # Test files
├── migrations/            # Database migrations
├── scripts/               # Utility scripts
├── .github/workflows/     # CI/CD pipelines
├── docker-compose.yml     # Local development stack
├── Dockerfile            # Multi-stage Docker build
├── serverless.yml        # AWS Lambda configuration
├── package.json          # Dependencies & scripts
└── README.md             # Full documentation
```

## Next Steps

### For Development

1. **Read the main README**: `cat README.md`
2. **Explore the codebase**: Start with `src/functions/fee-indexer/index.ts`
3. **Run the test suite**: `npm test`
4. **Make a change**: Edit a file and see hot-reload in action
5. **Commit your work**: Git hooks will auto-lint and test

### For Deployment

1. **Configure AWS credentials**:
   ```bash
   aws configure
   ```

2. **Setup AWS resources**: Follow the infrastructure guide in the main README

3. **Deploy to development**:
   ```bash
   make deploy-dev
   # or
   npm run deploy:dev
   ```

4. **Monitor logs**:
   ```bash
   make logs-dev
   # or
   serverless logs -f feeIndexer --stage dev --tail
   ```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :3000  # Application
lsof -i :4566  # LocalStack

# Stop the conflicting service or change ports in docker-compose.yml
```

### Docker Container Won't Start

```bash
# View container logs
docker-compose logs <service-name>

# Remove all containers and volumes, start fresh
docker-compose down -v
docker-compose up -d
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres

# Verify connection
docker-compose exec postgres pg_isready -U postgres
```

### Tests Failing

```bash
# Clear test cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check environment variables
cat .env.test
```

### LocalStack Not Working

```bash
# Restart LocalStack
docker-compose restart localstack

# Check LocalStack logs
docker-compose logs localstack

# Manually initialize LocalStack
docker-compose exec localstack bash /etc/localstack/init/ready.d/init-aws.sh
```

## Getting Help

- 📖 **Full Documentation**: See [README.md](./README.md)
- 📋 **Technical Spec**: See [../SERVERLESS_TECHNICAL_SPEC.md](../SERVERLESS_TECHNICAL_SPEC.md)
- 🐛 **Report Issues**: Create an issue on GitHub
- 💬 **Ask Questions**: Contact dev@kindsoul.com

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Serverless Framework Docs](https://www.serverless.com/framework/docs/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Docker Documentation](https://docs.docker.com/)

---

**Happy Coding! 🚀**

If you encounter any issues, please check the main README.md or create an issue on GitHub.
