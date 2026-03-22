# ---------- Build stage ---------
FROM node:20-bullseye AS builder

WORKDIR /app

# Install required build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gcc \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first (better caching)
COPY package.json package-lock.json ./

# Install dependencies (clean, fast, reliable)
RUN npm ci --legacy-peer-deps

# Copy project files
COPY . .

# Build arguments for Sentry
ARG SENTRY_AUTH_TOKEN
ARG VITE_APP_VERSION
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

# Build production bundle
RUN npm run build

# Upload source maps to Sentry (only if token provided)
RUN if [ -n "$SENTRY_AUTH_TOKEN" ]; then \
      echo "Uploading source maps to Sentry..."; \
      npx @sentry/cli sourcemaps inject ./dist && \
      npx @sentry/cli sourcemaps upload ./dist \
        --release=kindswap-frontend@${VITE_APP_VERSION} \
        --org=kindswap \
        --project=kindswap-frontend && \
      echo "Source maps uploaded successfully"; \
    else \
      echo "SENTRY_AUTH_TOKEN not provided, skipping source map upload"; \
    fi

# SECURITY: Remove source maps before copying to production image
# Maps are already uploaded to Sentry, no need to keep them in container
RUN find ./dist -name "*.map" -type f -delete && \
    echo "Source maps removed from build artifacts"


# ---------- Production stage ----------
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
