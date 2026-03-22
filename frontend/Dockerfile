# ============================================================
# Stage 1: Build
# Use node:20-slim for the build stage
# The build output is a static directory — no Node.js at runtime
# ============================================================
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy source code
COPY . .

# Vite production build — outputs to dist/
RUN npm run build

# ============================================================
# Stage 2: Production runtime (nginx:alpine)
# The frontend is a static SPA — served by Nginx
# No Node.js required at runtime — nginx:alpine is correct here
# KindSwap frontend is a client-side React SPA (Vite)
# — NOT Next.js, NOT RSC, NOT server-side rendering
# This confirms no React Server Components vulnerabilities apply
# ============================================================
FROM nginx:alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy Vite build output from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx serves on port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
