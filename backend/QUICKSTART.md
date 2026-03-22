# KindSwap Backend - Quick Start Guide

## Overview
This is a basic NestJS backend setup for the KindSwap platform.

**Current State**: Health check endpoint only. No business logic yet.

## Prerequisites
- Node.js 20+
- npm

## Quick Start

### 1. Start the Backend
```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### 2. Test the Health Endpoint
```bash
curl http://localhost:3000/health

# Response:
# {
#   "status": "ok",
#   "timestamp": "2024-01-12T10:30:00.000Z",
#   "service": "KindSwap Backend",
#   "version": "0.1.0"
# }
```

## Project Structure (Current)

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── app.controller.ts          # Health endpoint
└── app.controller.spec.ts     # Tests
```

## Available Scripts

```bash
npm run start                 # Production start
npm run start:dev            # Development with hot reload
npm run build                # Build for production
npm run test                 # Run unit tests
npm run test:e2e             # Run E2E tests
npm run lint                 # Run ESLint
npm run format               # Format with Prettier
```

## Environment Variables

The current `.env` file only contains:
```
NODE_ENV=development
PORT=3000
```

This is a minimal setup with no database or cache configured yet.

## Docker Support

A `docker-compose.yml` is included for PostgreSQL and Redis when needed.

```bash
# Start infrastructure
docker-compose up -d

# Stop infrastructure
docker-compose down
```

## What's Included

✅ Basic NestJS application
✅ Health check endpoint
✅ TypeScript configuration
✅ Docker Compose setup (PostgreSQL, Redis)
✅ Test setup (Jest)
✅ ESLint & Prettier config
✅ Simple npm scripts

## What's Not Included (Yet)

❌ Database entities/models
❌ Business logic
❌ Authentication
❌ API documentation
❌ Any service endpoints

---

Ready to add features? See the architecture plan for next steps.
