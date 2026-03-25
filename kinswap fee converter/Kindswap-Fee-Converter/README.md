# Lambda Fee Converter

Automated fee conversion system for KindSwap that collects fees in various tokens, converts them to USDC, and distributes to cold wallets using AWS Lambda serverless architecture.

## Architecture Overview

```
EventBridge Schedules → Lambda Functions → RDS PostgreSQL
                              ↓
                         SQS Queues
                              ↓
                         Solana Blockchain
```

## Features

- **Fee Indexing**: Monitor Ops wallet every 10 seconds for incoming fee deposits
- **Conversion Planning**: Determine which tokens to convert every 15 minutes
- **Conversion Execution**: Execute token→USDC swaps via Jupiter on Solana
- **USDC Distribution**: Distribute accumulated USDC to 4 cold wallets hourly
- **Auto-Pause**: Automatically pause conversions if failure rate exceeds 30%
- **Admin Dashboard**: Full configuration via admin UI with audit logging

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Node.js | 20.x |
| **Language** | TypeScript | 5.x |
| **Database** | PostgreSQL + TimescaleDB | 16.x |
| **Framework** | Serverless Framework | 4.x |
| **Testing** | Jest | 29.x |
| **Container** | Docker | Latest |
| **AWS SDK** | @aws-sdk/client-* | 3.x |
| **Solana** | @solana/web3.js | 1.95.x |

## Project Structure

```
lambda-fee-converter/
├── src/
│   ├── functions/               # Lambda function handlers
│   │   ├── fee-indexer/
│   │   │   ├── index.ts
│   │   │   └── index.test.ts
│   │   ├── conversion-planner/
│   │   ├── conversion-executor/
│   │   └── usdc-distributor/
│   ├── shared/                  # Shared utilities
│   │   ├── db/
│   │   │   └── connection.ts
│   │   ├── utils/
│   │   │   └── logger.ts
│   │   ├── clients/            # External API clients
│   │   │   ├── jupiter.ts
│   │   │   ├── helius.ts
│   │   │   └── solana.ts
│   │   └── services/           # Business logic
│   ├── types/                   # TypeScript types
│   └── tests/                   # Test utilities
├── migrations/                  # Database migrations
├── scripts/                     # Utility scripts
├── docker-compose.yml
├── Dockerfile
├── serverless.yml
├── tsconfig.json
├── jest.config.js
├── package.json
└── README.md
```

## Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Docker** and **Docker Compose**
- **AWS Account** with appropriate permissions
- **Helius API Key** for Solana RPC
- **PostgreSQL** 16.x (or use Docker)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd lambda-fee-converter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required environment variables:
- `DB_HOST` - PostgreSQL host
- `DB_PASSWORD` - Database password
- `HELIUS_API_KEY` - Your Helius API key
- `OPS_WALLET_ADDRESS` - Operations wallet address
- `AWS_REGION` - AWS region (default: ap-south-1)

### 4. Start with Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL, LocalStack, App, Redis, PgAdmin)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

Services available:
- **Application**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **PgAdmin**: http://localhost:5050 (email: admin@kindsoul.com, password: admin)
- **LocalStack**: http://localhost:4566
- **Redis**: localhost:6379

### 5. Run Locally (Without Docker)

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate:up

# Seed policy data
npm run seed:policy

# Start development server
npm run dev
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

### Building

```bash
# Build for development
npm run build

# Build for production
npm run build:prod

# Clean build artifacts
npm run clean
```

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Serverless Framework installed globally: `npm install -g serverless`
3. AWS resources created (RDS, VPC, Security Groups, etc.)
4. SSM parameters configured with secrets

### Deploy to Development

```bash
# Deploy to dev environment
npm run deploy:dev

# Or using serverless directly
serverless deploy --stage dev
```

### Deploy to Production

```bash
# Deploy to production
npm run deploy:prod

# Or using serverless directly
serverless deploy --stage production
```

### Invoke Function Locally

```bash
# Invoke fee-indexer function locally
serverless invoke local -f feeIndexer

# With custom event data
serverless invoke local -f feeIndexer --path events/fee-indexer-event.json
```

### View Logs

```bash
# Tail logs for fee-indexer function
npm run logs -- -f feeIndexer --tail

# Or using serverless directly
serverless logs -f feeIndexer --stage dev --tail
```

## Docker Commands

### Build Docker Image

```bash
# Build production image
npm run docker:build

# Or using docker directly
docker build -t lambda-fee-converter:latest .

# Build specific stage
docker build --target development -t lambda-fee-converter:dev .
```

### Run Docker Container

```bash
# Start services with docker-compose
npm run docker:run

# Stop services
npm run docker:down
```

### Multi-stage Builds

The Dockerfile supports multiple targets:

- **builder**: Build stage for TypeScript compilation
- **tester**: Test stage (runs tests)
- **production**: Production Lambda image (smallest size)
- **development**: Development environment with hot reload
- **serverless**: Serverless deployment container

## Database Migrations

```bash
# Run migrations (upgrade database)
npm run migrate:up

# Rollback migrations
npm run migrate:down

# Seed initial policy data
npm run seed:policy
```

## Environment Configuration

### Development (.env.development)
- Uses LocalStack for AWS services
- Uses local PostgreSQL in Docker
- Debug logging enabled
- Auto-pause disabled

### Production (.env.production)
- Real AWS services (RDS, SQS, KMS)
- Secrets from AWS Secrets Manager
- Info logging level
- All security features enabled

### Testing (.env.test)
- Separate test database
- Mocked AWS services
- Error-level logging only

## Lambda Functions

### 1. Fee Indexer
- **Trigger**: EventBridge (every 10 seconds)
- **Memory**: 512 MB
- **Timeout**: 60 seconds
- **Purpose**: Monitor Ops wallet for incoming fees

### 2. Conversion Planner
- **Trigger**: EventBridge (every 15 minutes)
- **Memory**: 512 MB
- **Timeout**: 120 seconds
- **Purpose**: Decide which tokens to convert

### 3. Conversion Executor
- **Trigger**: SQS Queue
- **Memory**: 1024 MB
- **Timeout**: 180 seconds
- **Purpose**: Execute token→USDC swaps

### 4. USDC Distributor
- **Trigger**: EventBridge (every 1 hour)
- **Memory**: 512 MB
- **Timeout**: 120 seconds
- **Purpose**: Distribute USDC to cold wallets

## Monitoring

### CloudWatch Alarms

1. **DLQ Messages**: Alert when messages appear in Dead Letter Queue
2. **Lambda Errors**: Alert when error count exceeds threshold
3. **Lambda Timeout**: Alert on function timeouts

### Metrics

- Conversion success rate
- Average slippage
- Fee detection latency
- Ops wallet balance
- Distribution frequency

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Ensure PostgreSQL is running
   - Check DB credentials in .env
   - Verify VPC configuration (production)

2. **LocalStack not initializing**
   - Restart docker-compose
   - Check LocalStack logs: `docker-compose logs localstack`
   - Ensure port 4566 is available

3. **Lambda timeout**
   - Increase timeout in serverless.yml
   - Optimize database queries
   - Check Solana RPC performance

4. **Type errors in tests**
   - Run `npm install` to ensure all types are installed
   - Check tsconfig.json paths configuration

## Performance Optimization

- Use ARM64 architecture for Lambda (60% cost reduction)
- Enable connection pooling for PostgreSQL
- Implement Redis caching for token prices
- Use TimescaleDB for time-series data compression
- Optimize bundle size with esbuild

## Security Best Practices

✅ Wallet keys encrypted with AWS KMS
✅ Secrets stored in AWS Secrets Manager
✅ VPC isolation for Lambda and RDS
✅ IAM roles with least privilege
✅ Auto-pause on high failure rate
✅ Audit logging for all admin actions
✅ Rate limiting on API endpoints

## Cost Estimation

| Service | Monthly Cost |
|---------|--------------|
| Lambda | $5 |
| RDS PostgreSQL | $150 |
| SQS | $1 |
| EventBridge | $0 (free tier) |
| CloudWatch | $20 |
| Secrets Manager | $2 |
| KMS | $10 |
| **Total** | **~$188** |

(Excludes external services: Helius $249, Sentry $26)

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and add tests
3. Run tests: `npm test`
4. Lint code: `npm run lint:fix`
5. Commit with conventional commits: `git commit -m "feat: add new feature"`
6. Push and create a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Contact: dev@kindsoul.com

## Documentation

- [Technical Specification](../SERVERLESS_TECHNICAL_SPEC.md)
- [Database Schema](./docs/database-schema.md)
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

---

**Version**: 1.0.0
**Last Updated**: March 12, 2026
**Status**: Production Ready
