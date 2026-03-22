FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist/kindsoul-b/src ./src
COPY --from=builder /app/dist/tsconfig.build.tsbuildinfo ./

EXPOSE 3000
CMD ["node", "src/main.js"]
