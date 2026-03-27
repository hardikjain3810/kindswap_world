# ============================================================
# Stage 1: Dependencies
# Install all deps (including devDependencies for build)
# ============================================================
FROM node:20-slim AS dependencies

WORKDIR /app

# Copy package files first (leverages Docker layer cache)
# If package.json doesn't change, npm install is cached
COPY package.json package-lock.json ./

# Install ALL dependencies including devDependencies (needed for build)
RUN npm install --prefer-offline --legacy-peer-deps

# ============================================================
# Stage 2: Build
# Compile TypeScript to JavaScript
# ============================================================
FROM node:20-slim AS build

WORKDIR /app

# Copy node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build NestJS application (compiles TypeScript → dist/)
RUN npm run build

# ============================================================
# Stage 3: Production runtime
# Minimal image — only production dependencies + compiled code
# Uses node:20-slim (NOT alpine):
#   - alpine uses musl libc which breaks pg and bcrypt
#   - slim uses Debian glibc — full compatibility
#   - slim is ~240MB vs alpine ~170MB — acceptable trade-off
# ============================================================
FROM node:20-slim AS runtime

# Set non-root user for security
RUN groupadd -g 1001 nodejs && useradd -r -u 1001 -g nodejs nestjs

WORKDIR /app

# Copy only what's needed for production
# Production node_modules (no devDependencies)
COPY package.json package-lock.json ./
RUN npm install --omit=dev --prefer-offline --legacy-peer-deps && npm cache clean --force

# Copy compiled application from build stage
COPY --from=build /app/dist ./dist

# Set correct ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

# NestJS default port
EXPOSE 3000

# Health check — used by Kubernetes liveness/readiness probes
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

ENV NODE_ENV=production

CMD ["node", "dist/main"]
