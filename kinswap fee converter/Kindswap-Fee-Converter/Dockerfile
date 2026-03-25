# Multi-stage Dockerfile for AWS Lambda Node.js 20.x
# Production-ready with optimized build and minimal runtime image

# Stage 1: Build stage
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build:prod

# Remove dev dependencies
RUN npm prune --production

# Stage 2: Test stage (optional, can be used in CI/CD)
FROM builder AS tester

# Copy test files
COPY jest.config.js ./
COPY src ./src

# Run tests
RUN npm install --only=dev
RUN npm test

# Stage 3: Production stage for AWS Lambda
FROM public.ecr.aws/lambda/nodejs:20 AS production

# Set labels
LABEL maintainer="KindSoul Dev Team"
LABEL version="1.0.0"
LABEL description="Lambda Fee Converter - Production Image"

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=512"

# Copy built application from builder stage
COPY --from=builder /app/dist ${LAMBDA_TASK_ROOT}/
COPY --from=builder /app/node_modules ${LAMBDA_TASK_ROOT}/node_modules
COPY --from=builder /app/package.json ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "index.handler" ]

# Stage 4: Development stage (for local development)
FROM node:20-slim AS development

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --legacy-peer-deps

# Copy configuration files
COPY tsconfig*.json ./
COPY jest.config.js ./
COPY .eslintrc.js ./
COPY .prettierrc ./

# Copy source code
COPY src ./src

# Expose port for local development
EXPOSE 3000

# Default command for development
CMD ["npm", "run", "dev"]

# Stage 5: Serverless deployment stage
FROM node:20-slim AS serverless

WORKDIR /app

# Install serverless framework globally
RUN npm install -g serverless@latest

# Copy all files needed for deployment
COPY package*.json ./
COPY tsconfig*.json ./
COPY serverless.yml ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source
COPY src ./src

# Build the application
RUN npm run build:prod

# Default command for serverless deployment
CMD ["serverless", "deploy"]
